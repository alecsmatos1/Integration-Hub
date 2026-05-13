import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID } from 'class-validator';

export class CreateEndpointDto {
  @ApiProperty({ example: 'My GitHub Endpoint' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'ID of the integration connection to associate' })
  @IsUUID()
  connectionId: string;
}
