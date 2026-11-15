import { useCallback, useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { reservasService } from '../services/reservas.service'
import type { HistorialItem, OwnerReserva } from '../types/reservas'

interface OwnerReservasState {
  reservas: OwnerReserva[]
  /** Bookings that no longer exist: expired unpaid or cancelled by the owner. */
  historial: HistorialItem[]
  loading: boolean
  error: string | null
}

/** The bookings of the courts of the logged in owner, and the history of the ones that ended. */
export const useOwnerReservas = () => {
  const [state, setState] = useState<OwnerReservasState>({
    reservas: [],
    historial: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    try {
      // Bookings first: reading them frees the expired holds, so the history is read afterwards.
      const reservas = await reservasService.listForOwner()
      const historial = await reservasService.listHistorial()
      setState({ reservas, historial, loading: false, error: null })
    } catch (err) {
      setState((current) => ({ ...current, loading: false, error: getAuthErrorMessage(err) }))
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(reload, 0)
    return () => window.clearTimeout(first)
  }, [reload])

  return { ...state, reload }
}
