import { useCallback, useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { reservasService } from '../services/reservas.service'
import type { OwnerReserva } from '../types/reservas'

interface OwnerReservasState {
  reservas: OwnerReserva[]
  loading: boolean
  error: string | null
}

/** The bookings of the courts of the logged in owner. */
export const useOwnerReservas = () => {
  const [state, setState] = useState<OwnerReservasState>({
    reservas: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    try {
      const reservas = await reservasService.listForOwner()
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
