import { Posicion } from '@prisma/client'
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

  @Type(() => Date)
  @IsDate()
  fechaHora!: Date

  @IsEnum(Posicion)
  posicion!: Posicion

  @IsInt()
  @Min(1)
  @Max(10)
  jugadoresFaltantes!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mensaje?: string
}
