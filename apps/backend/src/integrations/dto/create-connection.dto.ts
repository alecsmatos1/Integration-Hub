import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateConnectionDto {
  @ApiProperty({ example: 'My GitHub' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'github' })
  @IsString()
  provider: string;

  @ApiPropertyOptional({ example: 'webhook-secret-value' })
  @IsString()
  @IsOptional()
  secret?: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
