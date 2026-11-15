import { IsIn, IsUUID } from 'class-validator'

export const TIPOS_PAGO = ['SENA', 'TOTAL'] as const
export type TipoPago = (typeof TIPOS_PAGO)[number]

export class CreateReservaDto {
  @IsUUID()
  turnoId!: string

  @IsIn(TIPOS_PAGO)
  tipoPago!: TipoPago
}
