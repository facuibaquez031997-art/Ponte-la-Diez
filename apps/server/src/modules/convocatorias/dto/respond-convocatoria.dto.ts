import { RespuestaEstado } from '@prisma/client'
import { IsEnum } from 'class-validator'

export class RespondConvocatoriaDto {
  @IsEnum(RespuestaEstado)
  estado!: RespuestaEstado
}
