import { api } from './api'
import type {
  Conversacion,
  CreateConversacionInput,
  Mensaje,
  Thread,
} from '../types/conversaciones'

export const conversacionesService = {
  create: (input: CreateConversacionInput) =>
    api.post<{ id: string }>('/conversaciones', input).then((r) => r.data),
  list: () => api.get<Conversacion[]>('/conversaciones').then((r) => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/conversaciones/no-leidas').then((r) => r.data.count),
  thread: (id: string, before?: string) =>
    api
      .get<Thread>(`/conversaciones/${id}/mensajes`, { params: before ? { before } : undefined })
      .then((r) => r.data),
  send: (id: string, cuerpo: string, ofertaTurnoId?: string) =>
    api
      .post<Mensaje>(`/conversaciones/${id}/mensajes`, { cuerpo, ofertaTurnoId })
      .then((r) => r.data),
  markRead: (id: string) => api.post(`/conversaciones/${id}/leida`).then(() => undefined),
  remove: (id: string) => api.delete(`/conversaciones/${id}`).then(() => undefined),
}
