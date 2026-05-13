import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

const STATUSES = ['pending', 'running', 'success', 'failed'] as const;

export class ListExecutionsDto {
  @ApiPropertyOptional({ enum: STATUSES, example: 'success' })
  @IsIn(STATUSES)
  @IsOptional()
  status?: (typeof STATUSES)[number];
}
