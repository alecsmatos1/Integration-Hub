import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { IntegrationsService } from '../integrations/integrations.service.js';
import { GitHubProvider } from '../integrations/providers/github.provider.js';
import { WorkflowsService } from '../workflows/workflows.service.js';
import { CreateEndpointDto } from './dto/create-endpoint.dto.js';

@Injectable()
export class WebhooksService {
  private readonly github = new GitHubProvider();

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly workflows: WorkflowsService,
  ) {}

  async createEndpoint(userId: string, dto: CreateEndpointDto) {
    const connection = await this.integrations.findConnectionById(dto.connectionId, userId);
    if (!connection) throw new NotFoundException('Connection not found');

    return this.prisma.webhookEndpoint.create({
      data: {
        userId,
        providerId: connection.providerId,
        connectionId: connection.id,
        name: dto.name,
      },
    });
  }

  listEndpoints(userId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { userId, isActive: true },
      include: { provider: true },
    });
  }

  listEvents(userId: string) {
    return this.prisma.webhookEvent.findMany({
      where: { endpoint: { userId } },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    });
  }

  async handleGithubWebhook(
    pathToken: string,
    rawBody: Buffer,
    headers: Record<string, string>,
  ) {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { pathToken, isActive: true },
      include: { connection: true },
    });
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');

    const signatureValid = await this.github.verifyWebhookSignature(
      rawBody,
      headers,
      endpoint.connection.secret ?? undefined,
    );

    if (endpoint.connection.secret && !signatureValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf-8')) as Record<string, unknown>;
    } catch {
      throw new BadRequestException('Invalid JSON payload');
    }

    const normalized = await this.github.normalizeWebhookEvent(parsedBody, headers);

    const event = await this.prisma.webhookEvent.create({
      data: {
        endpointId: endpoint.id,
        provider: 'github',
        eventType: normalized.eventType,
        externalEventId: normalized.externalEventId,
        headers: headers as object,
        rawPayload: parsedBody as object,
        normalizedPayload: normalized as object,
        signatureValid,
      },
    });

    await this.workflows.triggerForEvent(
      event.id,
      endpoint.userId,
      'github',
      normalized.eventType,
    );

    return event;
  }
}
