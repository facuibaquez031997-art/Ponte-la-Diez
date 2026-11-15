import { useCallback, useEffect, useRef, useState } from 'react'
import { isAxiosError } from 'axios'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { conversacionesService } from '../services/conversaciones.service'
import type { ConversacionHeader, Mensaje, Pulso } from '../types/conversaciones'

// The light pulse (connected, typing, did a message arrive) is asked often so "Escribiendo..."
// feels immediate; the messages are read only when the pulse says something arrived.
const PULSE_INTERVAL_MS = 2_000
// Even without news, read them now and then: an offered slot can be taken without any message.
const FULL_RELOAD_EVERY_PULSES = 5

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
 * One open conversation: asks for the pulse every couple of seconds while it is mounted, reads
 * the messages when a new one arrived, and marks it as read when the other side wrote something.
 * `onRead` lets the inbox refresh its unread counters.
 */
export const useThread = (id: string, onRead: () => void) => {
  const [state, setState] = useState<ThreadState>(EMPTY)
  const [pulso, setPulso] = useState<Pulso | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const lastReadId = useRef<string | null>(null)
  const lastPulseMessageAt = useRef<string | null | undefined>(undefined)
  const pulses = useRef(0)
  const onReadRef = useRef(onRead)

  useEffect(() => {
    onReadRef.current = onRead
  }, [onRead])

  const reload = useCallback(async () => {
    try {
      const thread = await conversacionesService.thread(id)
      setState((current) => {
        // Keep the older pages the user already loaded; the poll only brings the latest page.
        // An empty latest page means there is nothing to show (for example the user just
        // cleared the chat), so nothing from before may stay on screen.
        const firstOfPage = thread.mensajes[0]?.createdAt
        const older = firstOfPage ? current.mensajes.filter((m) => m.createdAt < firstOfPage) : []
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

  const pulse = useCallback(async () => {
    try {
      const next = await conversacionesService.pulse(id)
      setPulso(next)
      pulses.current += 1
      const arrived =
        lastPulseMessageAt.current !== undefined &&
        lastPulseMessageAt.current !== next.ultimoMensajeAt
      lastPulseMessageAt.current = next.ultimoMensajeAt
      if (arrived || pulses.current % FULL_RELOAD_EVERY_PULSES === 0) await reload()
    } catch (err) {
      // A missed pulse is not worth an error on screen: the next one will tell. A conversation
      // that disappeared is shown by the next full read.
      if (isAxiosError(err) && err.response?.status === 404) await reload()
    }
  }, [id, reload])

  useEffect(() => {
    lastReadId.current = null
    lastPulseMessageAt.current = undefined
    pulses.current = 0
    const first = window.setTimeout(() => {
      setState(EMPTY)
      setPulso(null)
      void reload()
    }, 0)
    const timer = window.setInterval(pulse, PULSE_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [reload, pulse])

  const send = useCallback(
    async (cuerpo: string, ofertaTurnoId?: string): Promise<boolean> => {
      setSending(true)
      setSendError(null)
      try {
        const mensaje = await conversacionesService.send(id, cuerpo, ofertaTurnoId)
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

  return { ...state, pulso, sending, sendError, send, loadOlder, reload }
}
