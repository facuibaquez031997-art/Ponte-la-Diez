import {
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'
import { SURFACES } from './create-cancha.dto.js'

export class UpdateCanchaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  direccion?: string

  @IsOptional()
  @IsIn(BARRIOS)
  barrio?: string

  @IsOptional()
  @IsIn(SURFACES)
  tipoSuperficie?: string

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  precioHora?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  montoSena?: number
}
