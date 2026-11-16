import { IsInt, IsUUID, Max, Min, ValidateIf } from 'class-validator'
import { MAX_CANTIDAD } from './limits.js'

/**
 * One court of an entry that uses the same physical space as a court of another entry of the
 * owner (one court of 11 divided into 3 of 5). Booking and paying one blocks the other.
 */
export class ComparteConDto {
  /** The other entry. */
  @IsUUID()
  canchaId!: string

  /** Which court of THIS entry shares the space (1 to its quantity). 0 or left out: all of them. */
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_CANTIDAD)
  numero?: number

  /** Which court of the OTHER entry shares the space. 0 or left out: all of them. */
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_CANTIDAD)
  otraNumero?: number
}

/** At most this many links can be sent when creating or editing a court. */
export const MAX_LINKS = 50
