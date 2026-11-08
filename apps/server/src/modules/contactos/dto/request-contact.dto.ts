import { IsEmail, MaxLength } from 'class-validator'

export class RequestContactDto {
  @IsEmail()
  @MaxLength(254)
  email!: string
}
