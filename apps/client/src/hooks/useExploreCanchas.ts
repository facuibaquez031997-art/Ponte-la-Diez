import { useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { canchasService } from '../services/canchas.service'
import type { Cancha, CanchaFilters, TurnoLibre } from '../types/canchas'

interface ExploreState {
  canchas: Cancha[]
  slots: Record<string, TurnoLibre[]>
  loading: boolean
  error: string | null
}

const INITIAL: ExploreState = { canchas: [], slots: {}, loading: true, error: null }

/** Courts that match the filters, each with its free slots for the chosen day. */
export const useExploreCanchas = (filters: CanchaFilters, fecha: string, enabled: boolean) => {
  const [state, setState] = useState<ExploreState>(INITIAL)
  const { barrio, tipoSuperficie, precioMax } = filters

  useEffect(() => {
    if (!enabled) return
    let ignore = false
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const canchas = await canchasService.list({ barrio, tipoSuperficie, precioMax })
        const entries = await Promise.all(
          canchas.map(
            async (cancha) =>
              [cancha.id, await canchasService.freeTurnos(cancha.id, fecha)] as const
          )
        )
        if (!ignore) {
          setState({ canchas, slots: Object.fromEntries(entries), loading: false, error: null })
        }
      } catch (err) {
        if (!ignore) setState({ ...INITIAL, loading: false, error: getAuthErrorMessage(err) })
      }
    }, 0)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [enabled, barrio, tipoSuperficie, precioMax, fecha])

  return state
}
