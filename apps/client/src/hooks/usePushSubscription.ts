import { useCallback, useEffect, useState } from 'react'
import { notificationsService } from '../services/notifications.service'

export type PushStatus = 'checking' | 'unsupported' | 'denied' | 'inactive' | 'active'

const isSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const urlBase64ToBytes = (base64Url: string): Uint8Array<ArrayBuffer> => {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const raw = atob((base64Url + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

const readInitialStatus = async (): Promise<PushStatus> => {
  if (!isSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const registration = await navigator.serviceWorker.getRegistration('/sw.js')
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? 'active' : 'inactive'
}

export const usePushSubscription = () => {
  const [status, setStatus] = useState<PushStatus>('checking')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    readInitialStatus()
      .then((initial) => active && setStatus(initial))
      .catch(() => active && setStatus('inactive'))
    return () => {
      active = false
    }
  }, [])

  const enable = useCallback(async () => {
    setError(null)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'inactive')
        return
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const publicKey = await notificationsService.publicKey()
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(publicKey),
        }))
      const { endpoint, keys } = subscription.toJSON()
      if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Suscripción incompleta')
      await notificationsService.subscribe({
        endpoint,
        keys: { p256dh: keys.p256dh, auth: keys.auth },
      })
      setStatus('active')
    } catch {
      setError('No pudimos activar los avisos. Probá de nuevo en un rato.')
      setStatus('inactive')
    }
  }, [])

  const disable = useCallback(async () => {
    setError(null)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      const subscription = await registration?.pushManager.getSubscription()
      if (subscription) {
        await notificationsService.unsubscribe(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setStatus('inactive')
    } catch {
      setError('No pudimos desactivar los avisos. Probá de nuevo en un rato.')
    }
  }, [])

  return { status, error, enable, disable }
}
