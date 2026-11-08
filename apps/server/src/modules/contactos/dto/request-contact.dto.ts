import { Transform } from 'class-transformer'
import { IsEmail, IsUUID, MaxLength, ValidateIf } from 'class-validator'

/** The player is identified either by an exact email or by the id picked from the name search. */
export class RequestContactDto {
  @ValidateIf((dto: RequestContactDto) => dto.usuarioId === undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(254)
  email?: string

  @ValidateIf((dto: RequestContactDto) => dto.email === undefined)
  @IsUUID()
  usuarioId?: string
}
