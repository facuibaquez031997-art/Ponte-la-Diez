import { api } from './api'
import type { Agenda } from '../types/agenda'

export const agendaService = {
  get: (fecha: string) => api.get<Agenda>('/agenda', { params: { fecha } }).then((r) => r.data),
}
