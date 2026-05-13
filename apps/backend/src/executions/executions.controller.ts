import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ExecutionsService } from './executions.service.js';

@ApiTags('executions')
@Controller('executions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ExecutionsController {
  constructor(private readonly service: ExecutionsService) {}

  @Get()
  @ApiOperation({ summary: 'List workflow executions' })
  list(@CurrentUser() user: { id: string }) {
    return this.service.list(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get execution details' })
  findOne(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.findOne(id, user.id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs in order' })
  findLogs(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.service.findLogs(id, user.id);
  }
}
