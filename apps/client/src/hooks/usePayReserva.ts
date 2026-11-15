import { useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { pagosService } from '../services/pagos.service'
import type { Reserva } from '../types/reservas'

/** Sends the player to Mercado Pago to pay a booking that is still pending. */
export const usePayReserva = () => {
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payError, setPayError] = useState<string | null>(null)

  const pay = async (reserva: Reserva) => {
    setPayingId(reserva.id)
    setPayError(null)
    try {
      const { initPoint } = await pagosService.createPreference(reserva.id)
      window.location.assign(initPoint)
    } catch (err) {
      setPayError(getAuthErrorMessage(err))
      setPayingId(null)
    }
  }

  return { payingId, payError, pay }
}
