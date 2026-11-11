export interface AppNotification {
  id: string
  convocatoriaId: string | null
  titulo: string
  cuerpo: string
  leida: boolean
  createdAt: string
}

export interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}
