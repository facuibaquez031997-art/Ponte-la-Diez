import { isAxiosError } from 'axios'

export const getAuthErrorMessage = (error: unknown): string => {
  if (isAxiosError<{ message?: string | string[] }>(error)) {
    const message = error.response?.data?.message
    if (Array.isArray(message)) return message.join('. ')
    if (message) return message
    if (!error.response) return 'No se pudo conectar con el servidor.'
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.'
}
