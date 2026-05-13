import { Module } from '@nestjs/common';
import { WorkflowsModule } from '../workflows/workflows.module.js';
import { ExecutionsController } from './executions.controller.js';
import { ExecutionsService } from './executions.service.js';

@Module({
  imports: [WorkflowsModule],
  controllers: [ExecutionsController],
  providers: [ExecutionsService],
})
export class ExecutionsModule {}
