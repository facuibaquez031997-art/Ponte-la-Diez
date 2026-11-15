export interface AppNotification {
  id: string
  convocatoriaId: string | null
  reservaId: string | null
  /** Screen the notification opens, when the server says so. Older ones have none. */
  url: string | null
  titulo: string
  cuerpo: string
  leida: boolean
  createdAt: string
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
