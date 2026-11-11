import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { BARRIOS } from '../barrios.js'

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string

  @IsOptional()
  @IsIn(BARRIOS)
  barrioPontevedra?: string
}
