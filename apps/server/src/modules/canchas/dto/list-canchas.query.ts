import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'
import { SURFACES, TAMANOS } from './create-cancha.dto.js'

export class ListCanchasQuery {
  @IsOptional()
  @IsIn(BARRIOS)
  barrio?: string

  @IsOptional()
  @IsIn(SURFACES)
  tipoSuperficie?: string

  @IsOptional()
  @Type(() => Number)
  @IsIn(TAMANOS, { message: 'jugadores debe ser 5, 7, 9 u 11' })
  jugadores?: number

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  precioMax?: number
}
