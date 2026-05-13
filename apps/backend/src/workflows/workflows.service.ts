import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { InMemoryQueueService } from './queue/in-memory-queue.service.js';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: InMemoryQueueService,
  ) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    const orders = dto.steps.map((s) => s.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Step orders must be unique');
    }

    return this.prisma.workflow.create({
      data: {
        userId,
        name: dto.name,
        triggerProvider: dto.triggerProvider,
        triggerEvent: dto.triggerEvent,
        steps: {
          create: dto.steps.map((s) => ({
            order: s.order,
            type: s.type,
            provider: s.provider,
            action: s.action,
            config: (s.config ?? {}) as object,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  list(userId: string) {
    return this.prisma.workflow.findMany({
      where: { userId },
      include: { steps: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async executeManually(workflowId: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, userId },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');

    return this.createAndEnqueue(workflowId, null, 0);
  }

  async retryExecution(executionId: string, userId: string) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id: executionId, status: 'failed', workflow: { userId } },
    });
    if (!execution) throw new NotFoundException('Failed execution not found');

    return this.createAndEnqueue(execution.workflowId, execution.webhookEventId, execution.retryCount + 1);
  }

  async triggerForEvent(
    webhookEventId: string,
    userId: string,
    provider: string,
    eventType: string,
  ) {
    const workflows = await this.prisma.workflow.findMany({
      where: { userId, triggerProvider: provider, triggerEvent: eventType, isActive: true },
    });

    for (const workflow of workflows) {
      await this.createAndEnqueue(workflow.id, webhookEventId);
    }
  }

  private async createAndEnqueue(workflowId: string, webhookEventId: string | null, retryCount = 0) {
    const execution = await this.prisma.workflowExecution.create({
      data: { workflowId, webhookEventId, status: 'pending', retryCount },
    });
    await this.queue.enqueueWorkflowExecution(execution.id);
    return execution;
  }
}
