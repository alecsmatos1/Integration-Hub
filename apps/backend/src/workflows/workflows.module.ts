import { Module } from '@nestjs/common';
import { WorkflowRunner } from './engine/workflow-runner.js';
import { InMemoryQueueService } from './queue/in-memory-queue.service.js';
import { WorkflowsController } from './workflows.controller.js';
import { WorkflowsService } from './workflows.service.js';

@Module({
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowRunner, InMemoryQueueService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
