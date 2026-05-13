import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';

@Injectable()
export class ExecutionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.workflowExecution.findMany({
      where: { workflow: { userId } },
      include: { workflow: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, userId: string) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id, workflow: { userId } },
      include: { workflow: { include: { steps: { orderBy: { order: 'asc' } } } } },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  async findLogs(id: string, userId: string) {
    const execution = await this.prisma.workflowExecution.findFirst({
      where: { id, workflow: { userId } },
    });
    if (!execution) throw new NotFoundException('Execution not found');

    return this.prisma.executionLog.findMany({
      where: { executionId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}
