import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre: string

  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string

  @IsOptional()
  @IsIn(['PLAYER', 'OWNER'])
  rol?: 'PLAYER' | 'OWNER'

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  barrioPontevedra?: string
}
