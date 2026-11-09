import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsInt, Matches, Max, Min, ValidateNested } from 'class-validator'

const WHOLE_HOUR = /^([01]\d|2[0-4]):00$/

export class FranjaDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dia!: number

  @Matches(WHOLE_HOUR, { message: 'desde debe ser una hora exacta, por ejemplo 15:00' })
  desde!: string

  @Matches(WHOLE_HOUR, { message: 'hasta debe ser una hora exacta, por ejemplo 00:00' })
  hasta!: string
}

export class ReplaceHorariosDto {
  @IsArray()
  @ArrayMaxSize(70)
  @ValidateNested({ each: true })
  @Type(() => FranjaDto)
  franjas!: FranjaDto[]
}
