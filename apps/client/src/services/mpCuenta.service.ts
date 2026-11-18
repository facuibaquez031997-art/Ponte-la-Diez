import { api } from './api'

export interface MpCuentaStatus {
  linked: boolean
}

export const mpCuentaService = {
  getStatus: () => api.get<MpCuentaStatus>('/pagos/mp/status').then((r) => r.data),
  getAuthorizeUrl: () => api.get<{ url: string }>('/pagos/mp/authorize').then((r) => r.data.url),
}
