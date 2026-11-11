import { Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsPositive } from 'class-validator'
import { BARRIOS } from '../../users/barrios.js'
import { SURFACES } from './create-cancha.dto.js'

export class ListCanchasQuery {
  @IsOptional()
  @IsIn(BARRIOS)
  barrio?: string

  @IsOptional()
  @IsIn(SURFACES)
  tipoSuperficie?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  precioMax?: number
}
