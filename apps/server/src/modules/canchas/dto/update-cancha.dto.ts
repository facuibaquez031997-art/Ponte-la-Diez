import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'
import { MAX_CANTIDAD, SURFACES, TAMANOS } from './create-cancha.dto.js'

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

  // Not @IsOptional: it would let a null through, and null is not a size nor a quantity.
  @ValidateIf((_, value) => value !== undefined)
  @IsIn(TAMANOS, { message: 'jugadores debe ser 5, 7, 9 u 11' })
  jugadores?: number

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_CANTIDAD, { message: `cantidad no puede superar ${MAX_CANTIDAD}` })
  cantidad?: number

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
