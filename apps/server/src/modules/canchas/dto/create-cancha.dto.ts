import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'

export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const
// Players per side: a court of 5, 7, 9 or 11.
export const TAMANOS = [5, 7, 9, 11] as const
// How many courts of one size an entry can have (that many slots at the same hour).
export const MAX_CANTIDAD = 10

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

  @IsIn(TAMANOS, { message: 'jugadores debe ser 5, 7, 9 u 11' })
  jugadores!: number

  /** How many courts of this size there are. Left out, there is one. */
  // Not @IsOptional: it would let a null through, and null is not a quantity.
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_CANTIDAD, { message: `cantidad no puede superar ${MAX_CANTIDAD}` })
  cantidad?: number

  /**
   * The other entries of the owner that use the same physical space (one court of 11 divided into
   * 3 of 5): booking one blocks the others at that hour. Left out, the links do not change.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  comparteCon?: string[]

  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  precioHora!: number

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  montoSena!: number
}
