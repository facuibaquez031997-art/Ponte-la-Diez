import { useCallback, useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { conversacionesService } from '../services/conversaciones.service'
import type { Conversacion } from '../types/conversaciones'

// Short enough for the connected dots and "Escribiendo..." of the inbox to feel alive.
const POLL_INTERVAL_MS = 10_000

interface ConversacionesState {
  conversaciones: Conversacion[]
  loading: boolean
  error: string | null
}

/** The inbox of the logged in user. `reload` refreshes it quietly (no loading flicker). */
export const useConversaciones = () => {
  const [state, setState] = useState<ConversacionesState>({
    conversaciones: [],
    loading: true,
    error: null,
  })

  const reload = useCallback(async () => {
    try {
      const conversaciones = await conversacionesService.list()
      setState({ conversaciones, loading: false, error: null })
    } catch (err) {
      setState((current) => ({ ...current, loading: false, error: getAuthErrorMessage(err) }))
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(reload, 0)
    const timer = window.setInterval(reload, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [reload])

  return { ...state, reload }
}
