import {
  ArrayMaxSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { BARRIOS } from '../../users/barrios.js'
import { SURFACES, TAMANOS } from './create-cancha.dto.js'
import { ComparteConDto, MAX_LINKS } from './comparte-con.dto.js'
import { MAX_CANTIDAD } from './limits.js'

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
