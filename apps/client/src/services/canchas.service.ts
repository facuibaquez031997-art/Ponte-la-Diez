import { api } from './api'
import type { Cancha, CanchaInput, Franja } from '../types/canchas'

export const canchasService = {
  listMine: () => api.get<Cancha[]>('/canchas/mine').then((r) => r.data),
  get: (id: string) => api.get<Cancha>(`/canchas/${id}`).then((r) => r.data),
  create: (input: CanchaInput) => api.post<Cancha>('/canchas', input).then((r) => r.data),
  update: (id: string, input: CanchaInput) =>
    api.patch<Cancha>(`/canchas/${id}`, input).then((r) => r.data),
  remove: (id: string) => api.delete(`/canchas/${id}`).then(() => undefined),
  getHorarios: (id: string) => api.get<Franja[]>(`/canchas/${id}/horarios`).then((r) => r.data),
  saveHorarios: (id: string, franjas: Franja[]) =>
    api.put<Franja[]>(`/canchas/${id}/horarios`, { franjas }).then((r) => r.data),
}
