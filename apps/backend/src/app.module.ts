import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './common/prisma.module.js';
import { ExecutionsModule } from './executions/executions.module.js';
import { HealthModule } from './health/health.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { UsersModule } from './users/users.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    UsersModule,
    AuthModule,
    IntegrationsModule,
    WorkflowsModule,
    WebhooksModule,
    ExecutionsModule,
  ],
})
export class AppModule {}
