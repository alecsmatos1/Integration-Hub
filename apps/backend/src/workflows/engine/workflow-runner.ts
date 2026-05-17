import { Injectable, Logger } from '@nestjs/common';
import { WorkflowStep } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service.js';

@Injectable()
export class WorkflowRunner {
  private readonly logger = new Logger(WorkflowRunner.name);

  constructor(private readonly prisma: PrismaService) {}

  async run(executionId: string): Promise<void> {
    const execution = await this.prisma.workflowExecution.findUnique({
      where: { id: executionId },
      include: {
        workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!execution) {
      this.logger.error(`Execution not found: ${executionId}`);
      return;
    }

    const startedAt = new Date();
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { status: 'running', startedAt },
    });

    try {
      for (const step of execution.workflow.steps) {
        const stepStart = Date.now();
        await this.writeLog(executionId, step.id, 'info', `Starting step [${step.order}] type="${step.type}"`);
        await this.executeStep(executionId, step);
        const stepMs = Date.now() - stepStart;
        await this.writeLog(executionId, step.id, 'info', `Completed step [${step.order}] type="${step.type}" in ${stepMs}ms`, { durationMs: stepMs });
      }

      const finishedAt = new Date();
      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'success',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        },
      });
    } catch (err: unknown) {
      const finishedAt = new Date();
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          finishedAt,
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          errorMessage,
        },
      });
      await this.writeLog(executionId, null, 'error', `Execution failed: ${errorMessage}`);
    }
  }

  private async executeStep(executionId: string, step: WorkflowStep): Promise<void> {
    const config = step.config as Record<string, unknown>;

    switch (step.type) {
      case 'log': {
        const message = (config.message as string) ?? 'Log step executed';
        await this.writeLog(executionId, step.id, 'info', message);
        break;
      }
      case 'http_request': {
        const url = config.url as string;
        if (!url) throw new Error('http_request step requires a url');
        const method = ((config.method as string) ?? 'GET').toUpperCase();
        const headers = (config.headers as Record<string, string>) ?? {};
        const body = config.body !== undefined ? JSON.stringify(config.body) : undefined;
        const timeoutMs = (config.timeoutMs as number) ?? 10_000;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const reqStart = Date.now();

        let status: number;
        let responsePreview: string | undefined;
        try {
          const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json', ...headers },
            body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
            signal: controller.signal,
          });
          clearTimeout(timer);
          status = response.status;
          const text = await response.text().catch(() => '');
          responsePreview = text.slice(0, 200) || undefined;
        } catch (fetchErr: unknown) {
          clearTimeout(timer);
          const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
          throw new Error(`HTTP request failed: ${msg}`);
        }

        const durationMs = Date.now() - reqStart;
        const ok = status < 400;
        const level = ok ? 'info' : 'error';
        const summary = `${method} ${url} -> ${status} (${durationMs}ms)`;
        await this.writeLog(executionId, step.id, level, summary, {
          method,
          url,
          status,
          durationMs,
          responsePreview,
        });

        if (!ok) throw new Error(`HTTP ${status}: ${summary}`);
        break;
      }
      case 'http_request_mock': {
        const url = (config.url as string) ?? 'https://example.com';
        const method = (config.method as string) ?? 'GET';
        await this.writeLog(
          executionId,
          step.id,
          'info',
          `HTTP mock ${method} ${url} -> 200 OK`,
          { status: 200, body: 'mock response', url, method },
        );
        break;
      }
      default:
        throw new Error(`Unknown step type: "${step.type}"`);
    }
  }

  private async writeLog(
    executionId: string,
    stepId: string | null,
    level: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.executionLog.create({
      data: { executionId, stepId, level, message, metadata: metadata as object | undefined },
    });
  }
}
