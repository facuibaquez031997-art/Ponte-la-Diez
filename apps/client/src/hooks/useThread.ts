import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { conversacionesService } from '../services/conversaciones.service'
import type { ConversacionHeader, Mensaje } from '../types/conversaciones'

const POLL_INTERVAL_MS = 5_000

interface ThreadState {
  conversacion: ConversacionHeader | null
  mensajes: Mensaje[]
  hayMas: boolean
  loading: boolean
  /** The conversation does not exist or is not mine. */
  notFound: boolean
  error: string | null
}

const EMPTY: ThreadState = {
  conversacion: null,
  mensajes: [],
  hayMas: false,
  loading: true,
  notFound: false,
  error: null,
}

/**
 * One open conversation: polls every few seconds while it is mounted and marks it as read when
 * the other side wrote something new. `onRead` lets the inbox refresh its unread counters.
 */
export const useThread = (id: string, onRead: () => void) => {
  const [state, setState] = useState<ThreadState>(EMPTY)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const lastReadId = useRef<string | null>(null)
  const onReadRef = useRef(onRead)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  const reload = useCallback(async () => {
    try {
      const thread = await conversacionesService.thread(id)
      setState((current) => {
        // Keep the older pages the user already loaded; the poll only brings the latest page.
        const firstOfPage = thread.mensajes[0]?.createdAt
        const older = firstOfPage
          ? current.mensajes.filter((m) => m.createdAt < firstOfPage)
          : current.mensajes
        const loadedOlder = older.length > 0
        return {
          conversacion: thread.conversacion,
          mensajes: [...older, ...thread.mensajes],
          hayMas: loadedOlder ? current.hayMas : thread.hayMas,
          loading: false,
          notFound: false,
          error: null,
        }
      })

      const last = thread.mensajes.at(-1)
      if (last && !last.propio && lastReadId.current !== last.id) {
        lastReadId.current = last.id
        await conversacionesService.markRead(id)
        onReadRef.current()
      }
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        setState({ ...EMPTY, loading: false, notFound: true })
        return
      }
      setState((current) => ({ ...current, loading: false, error: getAuthErrorMessage(err) }))
    }
  }, [id])

  useEffect(() => {
    lastReadId.current = null
    const first = window.setTimeout(() => {
      setState(EMPTY)
      void reload()
    }, 0)
    const timer = window.setInterval(reload, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [reload])

  const send = useCallback(
    async (cuerpo: string): Promise<boolean> => {
      setSending(true)
      setSendError(null)
      try {
        const mensaje = await conversacionesService.send(id, cuerpo)
        setState((current) => ({ ...current, mensajes: [...current.mensajes, mensaje] }))
        onReadRef.current()
        return true
      } catch (err) {
        setSendError(getAuthErrorMessage(err))
        return false
      } finally {
        setSending(false)
      }
    },
    [id]
  )

  const loadOlder = useCallback(async () => {
    const oldest = state.mensajes[0]
    if (!oldest) return
    try {
      const page = await conversacionesService.thread(id, oldest.createdAt)
      setState((current) => ({
        ...current,
        mensajes: [...page.mensajes, ...current.mensajes],
        hayMas: page.hayMas,
      }))
    } catch (err) {
      setState((current) => ({ ...current, error: getAuthErrorMessage(err) }))
    }
  }, [id, state.mensajes])

  return { ...state, sending, sendError, send, loadOlder }
}
