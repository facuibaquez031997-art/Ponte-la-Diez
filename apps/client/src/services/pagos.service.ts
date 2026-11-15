import { api } from './api'
import type { Preference } from '../types/reservas'

export const pagosService = {
  createPreference: (reservaId: string) =>
    api.post<Preference>('/pagos/create-preference', { reservaId }).then((r) => r.data),
}
