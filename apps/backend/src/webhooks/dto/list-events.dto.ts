import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

const PROVIDERS = ['github'] as const;

export class ListEventsDto {
  @ApiPropertyOptional({ enum: PROVIDERS, example: 'github' })
  @IsIn(PROVIDERS)
  @IsOptional()
  provider?: (typeof PROVIDERS)[number];

  // eventType is free text: GitHub sends many event types (push, pull_request, etc.)
  @ApiPropertyOptional({ example: 'push' })
  @IsString()
  @IsOptional()
  eventType?: string;
}
