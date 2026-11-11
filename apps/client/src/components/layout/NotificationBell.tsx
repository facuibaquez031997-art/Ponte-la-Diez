import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { usePushSubscription, type PushStatus } from '../../hooks/usePushSubscription'
import type { AppNotification } from '../../types/notifications'
import { notificationTarget } from './notificationTarget'

const formatAgo = (isoDate: string): string => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(isoDate).getTime()) / 60_000))
  if (minutes < 1) return 'Recién'
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  return `Hace ${Math.round(hours / 24)} d`
}

const PUSH_HINTS: Partial<Record<PushStatus, string>> = {
  denied:
    'Bloqueaste las notificaciones en el navegador. Habilitalas desde la configuración del sitio.',
  unsupported:
    'Este dispositivo no admite avisos push. En iPhone, agregá la app a la pantalla de inicio.',
}

const NotificationBell = () => {
  const { items, unread, refreshList, markRead, markAllRead } = useNotifications()
  const push = usePushSubscription()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = () => {
    if (!open) void refreshList()
    setOpen((current) => !current)
  }

  const handleSelect = (item: AppNotification) => {
    if (!item.leida) void markRead(item.id)
    setOpen(false)
    navigate(notificationTarget(item))
  }

  const hint = PUSH_HINTS[push.status]

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-on-primary-container transition-all hover:bg-surface-tint/20 hover:text-on-primary active:scale-[0.98]"
      >
        <span aria-hidden="true" className="material-symbols-outlined">
          notifications
        </span>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-primary"
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="fixed inset-x-4 top-[72px] z-50 rounded-3xl bg-surface-container-lowest shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <div className="flex items-center justify-between px-5 pb-2 pt-4">
            <h2 className="font-display text-headline-md uppercase tracking-wide text-on-surface">
              Avisos
            </h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-secondary hover:underline"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto px-2">
            {items.length === 0 && (
              <li className="px-3 py-6 text-center text-sm text-on-surface-variant">
                Todavía no tenés avisos.
              </li>
            )}
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-surface-container ${
                    item.leida ? '' : 'bg-secondary-fixed/40'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.leida ? 'bg-transparent' : 'bg-secondary'
                    }`}
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-bold text-on-surface">{item.titulo}</span>
                    <span className="text-sm text-on-surface-variant">{item.cuerpo}</span>
                    <span className="mt-1 text-xs text-on-surface-variant">
                      {formatAgo(item.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-outline-variant px-5 py-3">
            {push.status === 'inactive' && (
              <button
                type="button"
                onClick={() => void push.enable()}
                className="w-full rounded-xl bg-primary-container py-2.5 text-sm font-bold text-on-primary transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Activar avisos en este dispositivo
              </button>
            )}
            {push.status === 'active' && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-on-surface-variant">
                  Avisos activados en este dispositivo.
                </span>
                <button
                  type="button"
                  onClick={() => void push.disable()}
                  className="text-xs font-semibold text-secondary hover:underline"
                >
                  Desactivar
                </button>
              </div>
            )}
            {hint && <p className="text-xs text-on-surface-variant">{hint}</p>}
            {push.error && (
              <p role="alert" className="mt-2 text-xs text-error">
                {push.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
