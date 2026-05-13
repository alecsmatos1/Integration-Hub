import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service.js';
import { CreateConnectionDto } from './dto/create-connection.dto.js';

@Injectable()
export class IntegrationsService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.prisma.integrationProvider.upsert({
      where: { name: 'github' },
      update: {},
      create: { name: 'github', displayName: 'GitHub', isActive: true },
    });
  }

  listProviders() {
    return this.prisma.integrationProvider.findMany({ where: { isActive: true } });
  }

  async createConnection(userId: string, dto: CreateConnectionDto) {
    const provider = await this.prisma.integrationProvider.findUnique({
      where: { name: dto.provider },
    });
    if (!provider) throw new BadRequestException(`Unknown provider: ${dto.provider}`);

    const conn = await this.prisma.integrationConnection.create({
      data: {
        userId,
        providerId: provider.id,
        name: dto.name,
        secret: dto.secret,
        config: (dto.config ?? {}) as object,
      },
    });

    const { secret: _s, ...safe } = conn;
    return safe;
  }

  async listConnections(userId: string) {
    const conns = await this.prisma.integrationConnection.findMany({
      where: { userId, isActive: true },
      include: { provider: true },
    });
    return conns.map(({ secret: _s, ...safe }) => safe);
  }

  findConnectionById(id: string, userId: string) {
    return this.prisma.integrationConnection.findFirst({ where: { id, userId } });
  }
}
