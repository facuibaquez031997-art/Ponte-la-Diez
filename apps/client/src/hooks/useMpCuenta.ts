import { useCallback, useEffect, useState } from 'react'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { mpCuentaService } from '../services/mpCuenta.service'

interface MpCuentaState {
  linked: boolean
  loading: boolean
  error: string | null
}

/** Whether the logged in owner linked a Mercado Pago account, and how to start the link. */
export const useMpCuenta = () => {
  const [state, setState] = useState<MpCuentaState>({ linked: false, loading: true, error: null })
  const [redirecting, setRedirecting] = useState(false)

  const load = useCallback(async () => {
    try {
      const { linked } = await mpCuentaService.getStatus()
      setState({ linked, loading: false, error: null })
    } catch (err) {
      setState((current) => ({ ...current, loading: false, error: getAuthErrorMessage(err) }))
    }
  }, [])

  useEffect(() => {
    const first = window.setTimeout(load, 0)
    return () => window.clearTimeout(first)
  }, [load])

  /** Sends the owner to the Mercado Pago consent screen. */
  const link = async () => {
    setRedirecting(true)
    try {
      window.location.assign(await mpCuentaService.getAuthorizeUrl())
    } catch (err) {
      setRedirecting(false)
      setState((current) => ({ ...current, error: getAuthErrorMessage(err) }))
    }
  }

  return { ...state, redirecting, link }
}
