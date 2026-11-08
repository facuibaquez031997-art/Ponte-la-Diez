import { api } from './api'
import type { ContactsOverview } from '../types/contactos'

export const contactosService = {
  list: () => api.get<ContactsOverview>('/contactos').then((r) => r.data),
  request: (email: string) =>
    api.post<{ message: string }>('/contactos/solicitudes', { email }).then((r) => r.data),
  accept: (id: string) => api.patch(`/contactos/${id}/aceptar`).then((r) => r.data),
  remove: (id: string) => api.delete(`/contactos/${id}`).then(() => undefined),
}
