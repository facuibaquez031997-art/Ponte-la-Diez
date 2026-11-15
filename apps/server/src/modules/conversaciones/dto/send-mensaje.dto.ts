import { IsString, MaxLength } from 'class-validator'

export const MAX_MENSAJE_LENGTH = 1000

export class SendMensajeDto {
  @IsString()
  @MaxLength(MAX_MENSAJE_LENGTH, {
    message: `El mensaje no puede superar los ${MAX_MENSAJE_LENGTH} caracteres`,
  })
  cuerpo!: string
}
