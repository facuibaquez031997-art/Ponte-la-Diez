import { api } from './api'
import type {
  BarrioConvocatoria,
  Convocatoria,
  CreateConvocatoriaPayload,
} from '../types/convocatorias'

export const convocatoriasService = {
  create: (payload: CreateConvocatoriaPayload) =>
    api.post<Convocatoria>('/convocatorias', payload).then((r) => r.data),
  listForMyBarrio: () => api.get<BarrioConvocatoria[]>('/convocatorias').then((r) => r.data),
  listMine: () => api.get<Convocatoria[]>('/convocatorias/mine').then((r) => r.data),
  close: (id: string) => api.patch<Convocatoria>(`/convocatorias/${id}/close`).then((r) => r.data),
}
