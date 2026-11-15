import { useEffect } from 'react'
import { conversacionesService } from '../services/conversaciones.service'

const HEARTBEAT_INTERVAL_MS = 20_000

/**
 * Tells the server that the app is open while the user is logged in and looking at it, so the
 * people they talk to see them as connected. A hidden tab stops beating and shows as disconnected
 * a few seconds later.
 */
export const useHeartbeat = (active: boolean) => {
  useEffect(() => {
    if (!active) return

    const beat = () => {
      if (document.visibilityState !== 'visible') return
      // A missed beat only means a short "disconnected" blink: nothing to report.
      conversacionesService.heartbeat().catch(() => undefined)
    }

    const first = window.setTimeout(beat, 0)
    const timer = window.setInterval(beat, HEARTBEAT_INTERVAL_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [active])
}
