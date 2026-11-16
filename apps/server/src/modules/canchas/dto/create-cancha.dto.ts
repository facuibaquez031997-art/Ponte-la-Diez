import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { BARRIOS } from '../../users/barrios.js'
import { ComparteConDto, MAX_LINKS } from './comparte-con.dto.js'
import { MAX_CANTIDAD } from './limits.js'

export const SURFACES = ['Sintético', 'Césped natural', 'Cemento', 'Parquet'] as const
// Players per side: a court of 5, 7, 9 or 11.
export const TAMANOS = [5, 7, 9, 11] as const
export { MAX_CANTIDAD }

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
   * The courts of the owner's other entries that use the same physical space as a court of this
   * one (one court of 11 divided into 3 of 5): booking and paying one blocks the other. Each item
   * names the other entry and which court of each entry is involved (0 = all). Left out, the
   * links do not change; an empty list removes them.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(MAX_LINKS)
  @ValidateNested({ each: true })
  @Type(() => ComparteConDto)
  comparteCon?: ComparteConDto[]

  @IsNumber()
  @IsPositive()
  @Max(1_000_000)
  precioHora!: number

  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  montoSena!: number
}
