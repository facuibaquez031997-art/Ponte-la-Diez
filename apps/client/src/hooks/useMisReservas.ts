import { useCallback, useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { reservasService } from '../services/reservas.service'
import type { Reserva } from '../types/reservas'

interface MisReservasState {
  reservas: Reserva[]
  loading: boolean
  error: string | null
}

/** The bookings of the logged in player. `reload` refreshes them quietly (no loading flicker). */
export const useMisReservas = () => {
  const [state, setState] = useState<MisReservasState>({
    reservas: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    try {
      const reservas = await reservasService.listMine()
      setState({ reservas, loading: false, error: null })
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
