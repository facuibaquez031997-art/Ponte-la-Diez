import { Injectable } from '@nestjs/common'

/** The app sends a heartbeat every 20 seconds: one missed beat is tolerated before "disconnected". */
export const ONLINE_MS = 45_000
/** "Escribiendo..." fades by itself shortly after the last keystroke. */
export const TYPING_MS = 4_000
const PRUNE_AT = 2_000

/**
 * Who is connected and who is typing. It is ephemeral by nature, so it lives in the memory of the
 * server: a restart only shows everybody as disconnected until their next heartbeat. With more
 * than one server instance this has to move to a shared store (see the pending list).
 */
@Injectable()
export class PresenceService {
  private readonly lastSeen = new Map<string, number>()
  private readonly lastTyping = new Map<string, number>()

  beat(userId: string, now: number = Date.now()): void {
    this.lastSeen.set(userId, now)
    this.prune(now)
  }

  isOnline(userId: string, now: number = Date.now()): boolean {
    const seen = this.lastSeen.get(userId)
    return seen !== undefined && now - seen < ONLINE_MS
  }

  typing(conversacionId: string, userId: string, now: number = Date.now()): void {
    this.lastTyping.set(`${conversacionId}:${userId}`, now)
    // Typing is also proof that the person is here.
    this.beat(userId, now)
  }

  stopTyping(conversacionId: string, userId: string): void {
    this.lastTyping.delete(`${conversacionId}:${userId}`)
  }

  isTyping(conversacionId: string, userId: string, now: number = Date.now()): boolean {
    const last = this.lastTyping.get(`${conversacionId}:${userId}`)
    return last !== undefined && now - last < TYPING_MS
  }

  /** Forget the ones that are long gone so the maps do not grow forever. */
  private prune(now: number): void {
    if (this.lastSeen.size < PRUNE_AT && this.lastTyping.size < PRUNE_AT) return
    for (const [key, seen] of this.lastSeen) if (now - seen >= ONLINE_MS) this.lastSeen.delete(key)
    for (const [key, last] of this.lastTyping) {
      if (now - last >= TYPING_MS) this.lastTyping.delete(key)
    }
  }
}
