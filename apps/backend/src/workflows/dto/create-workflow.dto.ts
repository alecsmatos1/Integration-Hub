import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkflowStepDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ example: 'log', enum: ['log', 'http_request_mock'] })
  @IsIn(['log', 'http_request_mock'])
  type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  provider?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({ example: { message: 'Step executed' } })
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'Notify on push' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'github' })
  @IsString()
  triggerProvider: string;

  @ApiProperty({ example: 'push' })
  @IsString()
  triggerEvent: string;

  @ApiProperty({ type: [WorkflowStepDto] })
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];
}
