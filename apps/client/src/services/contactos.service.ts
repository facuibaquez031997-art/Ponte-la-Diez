import { api } from './api'
import type { ContactSearchResult, ContactsOverview } from '../types/contactos'

export const contactosService = {
  list: () => api.get<ContactsOverview>('/contactos').then((r) => r.data),
  search: (q: string) =>
    api.get<ContactSearchResult[]>('/contactos/buscar', { params: { q } }).then((r) => r.data),
  requestUser: (usuarioId: string) =>
    api.post<{ message: string }>('/contactos/solicitudes', { usuarioId }).then((r) => r.data),
  accept: (id: string) => api.patch(`/contactos/${id}/aceptar`).then((r) => r.data),
  remove: (id: string) => api.delete(`/contactos/${id}`).then(() => undefined),
}
