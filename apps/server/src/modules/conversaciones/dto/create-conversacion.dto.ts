import { IsOptional, IsUUID } from 'class-validator'

export class CreateConversacionDto {
  @IsUUID()
  canchaId!: string

  @IsOptional()
  @IsUUID()
  reservaId?: string
}
