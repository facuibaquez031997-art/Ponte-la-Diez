import { Alcance, Posicion } from '@prisma/client'
import { Type } from 'class-transformer'
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateConvocatoriaDto {
  @IsOptional()
  @IsUUID()
  canchaId?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  canchaNombre?: string

  @IsOptional()
  @IsEnum(Alcance)
  alcance?: Alcance

  @Type(() => Date)
  @IsDate()
  fechaHora!: Date

  @IsEnum(Posicion)
  posicion!: Posicion

  @IsInt()
  @Min(1)
  @Max(11)
  jugadoresFaltantes!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string
}
