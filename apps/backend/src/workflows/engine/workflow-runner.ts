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
        await this.writeLog(executionId, step.id, 'info', `Starting step [${step.order}] type="${step.type}"`);
        await this.executeStep(executionId, step);
        await this.writeLog(executionId, step.id, 'info', `Completed step [${step.order}] type="${step.type}"`);
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
