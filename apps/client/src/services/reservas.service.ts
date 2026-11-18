import { api } from './api'
import type {
  CancelResult,
  CreateReservaInput,
  HistorialItem,
  OwnerReserva,
  Reserva,
} from '../types/reservas'

export const reservasService = {
  create: (input: CreateReservaInput) => api.post<Reserva>('/reservas', input).then((r) => r.data),
  listMine: () => api.get<Reserva[]>('/reservas/mine').then((r) => r.data),
  listForOwner: () => api.get<OwnerReserva[]>('/reservas/owner').then((r) => r.data),
  listHistorial: () => api.get<HistorialItem[]>('/reservas/owner/historial').then((r) => r.data),
  cancel: (id: string) => api.post<CancelResult>(`/reservas/${id}/cancelar`).then((r) => r.data),
  /** Refunds the player from the owner's Mercado Pago account (retry of a pending refund). */
  refundNow: (id: string) =>
    api.patch<HistorialItem>(`/reservas/historial/${id}/devolucion`).then((r) => r.data),
}
