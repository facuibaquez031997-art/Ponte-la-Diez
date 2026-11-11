import {
  IsIn,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'

export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const

export class CreateCanchaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  direccion!: string

  @IsIn(BARRIOS)
  barrio!: string

  @IsIn(SURFACES)
  tipoSuperficie!: string

  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  precioHora!: number

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  montoSena!: number
}
