import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { WorkflowsService } from './workflows.service.js';

@ApiTags('workflows')
@Controller('workflows')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateWorkflowDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List your workflows' })
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Manually trigger a workflow execution' })
  execute(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.executeManually(id, user.id);
  }
}
