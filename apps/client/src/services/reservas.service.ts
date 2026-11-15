import { api } from './api'
import type { CreateReservaInput, OwnerReserva, Reserva } from '../types/reservas'

export const reservasService = {
  create: (input: CreateReservaInput) => api.post<Reserva>('/reservas', input).then((r) => r.data),
  listMine: () => api.get<Reserva[]>('/reservas/mine').then((r) => r.data),
  listForOwner: () => api.get<OwnerReserva[]>('/reservas/owner').then((r) => r.data),
}
