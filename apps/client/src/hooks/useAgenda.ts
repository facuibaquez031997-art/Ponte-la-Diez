import { useCallback, useEffect, useRef, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { agendaService } from '../services/agenda.service'
import type { Agenda } from '../types/agenda'

const POLL_INTERVAL_MS = 30_000

interface AgendaState {
  agenda: Agenda | null
  loading: boolean
  error: string | null
}

/**
 * The agenda of the owner for one day (AAAA-MM-DD). It refreshes by itself, so a new booking
 * shows up without reloading, and a slow answer for a day the owner already left is ignored.
 */
export const useAgenda = (fecha: string) => {
  const [state, setState] = useState<AgendaState>({ agenda: null, loading: true, error: null })
  const latest = useRef(0)

  const reload = useCallback(async () => {
    const request = ++latest.current
    try {
      const agenda = await agendaService.get(fecha)
      if (request === latest.current) setState({ agenda, loading: false, error: null })
    } catch (err) {
      if (request === latest.current) {
        setState((current) => ({ ...current, loading: false, error: getAuthErrorMessage(err) }))
      }
    }
  }, [fecha])

  useEffect(() => {
    const first = window.setTimeout(() => {
      setState((current) => ({ ...current, loading: true }))
      void reload()
    }, 0)
    const timer = window.setInterval(reload, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [reload])

  return { ...state, reload }
}
