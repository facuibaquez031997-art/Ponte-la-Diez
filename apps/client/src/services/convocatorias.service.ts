import { api } from './api'
import type { Convocatoria, CreateConvocatoriaPayload } from '../types/convocatorias'

export const convocatoriasService = {
  create: (payload: CreateConvocatoriaPayload) =>
    api.post<Convocatoria>('/convocatorias', payload).then((r) => r.data),
}
