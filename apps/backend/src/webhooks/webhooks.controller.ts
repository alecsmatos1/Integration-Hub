import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CreateEndpointDto } from './dto/create-endpoint.dto.js';
import { ListEventsDto } from './dto/list-events.dto.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('webhooks')
@Controller('webhooks')
@SkipThrottle()
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post('endpoints')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a webhook endpoint' })
  createEndpoint(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateEndpointDto,
  ) {
    return this.service.createEndpoint(user.id, dto);
  }

  @Get('endpoints')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List your webhook endpoints' })
  listEndpoints(@CurrentUser() user: { id: string }) {
    return this.service.listEndpoints(user.id);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List received webhook events' })
  listEvents(@CurrentUser() user: { id: string }, @Query() query: ListEventsDto) {
    return this.service.listEvents(user.id, query);
  }

  @Post('github/:pathToken')
  @SkipThrottle({ default: false })
  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @ApiOperation({ summary: 'Receive a GitHub webhook (public)' })
  receiveGithub(
    @Param('pathToken') pathToken: string,
    @Req() req: { rawBody?: Buffer },
    @Headers() headers: Record<string, string>,
    @Body() _body: unknown,
  ) {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(_body));
    return this.service.handleGithubWebhook(pathToken, rawBody, headers);
  }
}
