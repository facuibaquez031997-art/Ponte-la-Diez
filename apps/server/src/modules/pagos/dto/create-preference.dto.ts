import { IsUUID } from 'class-validator'

export class CreatePreferenceDto {
  @IsUUID()
  reservaId!: string
}
