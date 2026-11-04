import { api } from './api'
import type { AppNotification, PushSubscriptionPayload } from '../types/notifications'

export const notificationsService = {
  publicKey: () =>
    api.get<{ publicKey: string }>('/notifications/push/public-key').then((r) => r.data.publicKey),
  subscribe: (payload: PushSubscriptionPayload) =>
    api.post('/notifications/push/subscription', payload).then(() => undefined),
  unsubscribe: (endpoint: string) =>
    api.delete('/notifications/push/subscription', { data: { endpoint } }).then(() => undefined),
  list: () => api.get<AppNotification[]>('/notifications').then((r) => r.data),
  unreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data.count),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`).then(() => undefined),
  markAllRead: () => api.patch('/notifications/read-all').then(() => undefined),
}
