import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateConnectionDto } from './dto/create-connection.dto.js';
import { IntegrationsService } from './integrations.service.js';

@ApiTags('integrations')
@Controller('integrations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('providers')
  @ApiOperation({ summary: 'List available integration providers' })
  listProviders() {
    return this.service.listProviders();
  }

  @Post('connections')
  @ApiOperation({ summary: 'Create a new integration connection' })
  createConnection(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateConnectionDto,
  ) {
    return this.service.createConnection(user.id, dto);
  }

  @Get('connections')
  @ApiOperation({ summary: 'List your integration connections' })
  listConnections(@CurrentUser() user: { id: string }) {
    return this.service.listConnections(user.id);
  }
}
