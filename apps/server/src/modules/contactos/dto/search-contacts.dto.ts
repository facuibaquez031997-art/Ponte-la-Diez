import { IsString, MaxLength } from 'class-validator'

export class SearchContactsDto {
  @IsString()
  @MaxLength(80)
  q!: string
}
