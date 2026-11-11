import { useCallback, useEffect, useState } from 'react'
import { notificationsService } from '../services/notifications.service'
import type { AppNotification } from '../types/notifications'

const POLL_INTERVAL_MS = 60_000

export const useNotifications = () => {
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await notificationsService.unreadCount())
    } catch {
      // The badge is a convenience: keep the last known value when the request fails.
    }
  }, [])

  const refreshList = useCallback(async () => {
    try {
      setItems(await notificationsService.list())
    } catch {
      // Keep showing the previous list.
    }
    await refreshCount()
  }, [refreshCount])

  useEffect(() => {
    const first = window.setTimeout(refreshCount, 0)
    const timer = window.setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
    }
  }, [refreshCount])

  const markRead = useCallback(
    async (id: string) => {
      setItems((current) => current.map((n) => (n.id === id ? { ...n, leida: true } : n)))
      setUnread((count) => Math.max(0, count - 1))
      try {
        await notificationsService.markRead(id)
      } catch {
        await refreshList()
      }
    },
    [refreshList]
  )

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((n) => ({ ...n, leida: true })))
    setUnread(0)
    try {
      await notificationsService.markAllRead()
    } catch {
      await refreshList()
    }
  }, [refreshList])

  return { items, unread, refreshList, markRead, markAllRead }
}
