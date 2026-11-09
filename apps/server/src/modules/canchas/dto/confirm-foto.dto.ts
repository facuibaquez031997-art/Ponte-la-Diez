import { IsString, MaxLength, MinLength } from 'class-validator'

export class ConfirmFotoDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  publicId!: string
}
