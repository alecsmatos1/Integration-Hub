import { Injectable } from '@nestjs/common';
import { WorkflowRunner } from '../engine/workflow-runner.js';

export interface ExecutionQueue {
  enqueueWorkflowExecution(executionId: string): Promise<void>;
}

@Injectable()
export class InMemoryQueueService implements ExecutionQueue {
  constructor(private readonly runner: WorkflowRunner) {}

  async enqueueWorkflowExecution(executionId: string): Promise<void> {
    setImmediate(() => {
      this.runner.run(executionId).catch(() => {
        // errors are persisted inside run() - nothing to propagate here
      });
    });
  }
}
