import { api } from './api'
import type { Cancha, CanchaFoto, CanchaInput, Franja, FotoUploadSignature } from '../types/canchas'

export const canchasService = {
  listMine: () => api.get<Cancha[]>('/canchas/mine').then((r) => r.data),
  get: (id: string) => api.get<Cancha>(`/canchas/${id}`).then((r) => r.data),
  create: (input: CanchaInput) => api.post('/canchas', input).then(() => undefined),
  update: (id: string, input: CanchaInput) =>
    api.patch(`/canchas/${id}`, input).then(() => undefined),
  remove: (id: string) => api.delete(`/canchas/${id}`).then(() => undefined),
  fotoSignature: (id: string) =>
    api.post<FotoUploadSignature>(`/canchas/${id}/fotos/signature`).then((r) => r.data),
  confirmFoto: (id: string, publicId: string) =>
    api.post<CanchaFoto>(`/canchas/${id}/fotos`, { publicId }).then((r) => r.data),
  removeFoto: (id: string, fotoId: string) =>
    api.delete(`/canchas/${id}/fotos/${fotoId}`).then(() => undefined),
  getHorarios: (id: string) => api.get<Franja[]>(`/canchas/${id}/horarios`).then((r) => r.data),
  saveHorarios: (id: string, franjas: Franja[]) =>
    api.put<Franja[]>(`/canchas/${id}/horarios`, { franjas }).then((r) => r.data),
}
