import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthErrorMessage } from '../pages/Auth/authError'
import { conversacionesService } from '../services/conversaciones.service'
import type { CreateConversacionInput } from '../types/conversaciones'

/**
 * A player opens (or reopens) the chat with the owner of a court and lands on it. `startingKey`
 * is the booking or the court being opened, so each button knows whether it is the busy one.
 * With `firstMessage` the chat also gets a ready message, so the owner knows what it is about.
 */
export const useStartConversacion = () => {
  const navigate = useNavigate()
  const [startingKey, setStartingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(
    async (input: CreateConversacionInput, firstMessage?: string) => {
      setStartingKey(input.reservaId ?? input.canchaId)
      setError(null)
      try {
        const { id } = await conversacionesService.create(input)
        if (firstMessage) {
          // The chat is already open: a message that could not be sent only means the player
          // writes it by hand, so it must not stop them from reaching the chat.
          await conversacionesService.send(id, firstMessage).catch(() => undefined)
        }
        navigate(`/mensajes/${id}`)
      } catch (err) {
        setError(getAuthErrorMessage(err))
        setStartingKey(null)
      }
    },
    [navigate]
  )

  return { startingKey, error, start }
}
