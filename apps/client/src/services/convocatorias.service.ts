import { api } from './api'
import type {
  BarrioConvocatoria,
  Convocatoria,
  ConvocatoriaTeam,
  CreateConvocatoriaPayload,
  RespuestaEstado,
} from '../types/convocatorias'

export const convocatoriasService = {
  create: (payload: CreateConvocatoriaPayload) =>
    api.post<Convocatoria>('/convocatorias', payload).then((r) => r.data),
  listForMyBarrio: () => api.get<BarrioConvocatoria[]>('/convocatorias').then((r) => r.data),
  listMine: () => api.get<Convocatoria[]>('/convocatorias/mine').then((r) => r.data),
  respond: (id: string, estado: RespuestaEstado) =>
    api.post(`/convocatorias/${id}/respuestas`, { estado }).then((r) => r.data),
  team: (id: string) =>
    api.get<ConvocatoriaTeam>(`/convocatorias/${id}/equipo`).then((r) => r.data),
  close: (id: string) => api.patch<Convocatoria>(`/convocatorias/${id}/close`).then((r) => r.data),
  cancel: (id: string) =>
    api.patch<Convocatoria>(`/convocatorias/${id}/cancel`).then((r) => r.data),
}
