import { ONLINE_MS, PresenceService, TYPING_MS } from './presence.service.js'

const T0 = 1_000_000

describe('PresenceService', () => {
  describe('connected', () => {
    it('nobody is connected until their app says so', () => {
      expect(new PresenceService().isOnline('u1', T0)).toBe(false)
    })

    it('is connected while the last heartbeat is recent, and disconnected after', () => {
      const presence = new PresenceService()
      presence.beat('u1', T0)

      expect(presence.isOnline('u1', T0 + ONLINE_MS - 1)).toBe(true)
      expect(presence.isOnline('u1', T0 + ONLINE_MS)).toBe(false)
    })

    it('a new heartbeat keeps the user connected, and each user is on their own', () => {
      const presence = new PresenceService()
      presence.beat('u1', T0)
      presence.beat('u1', T0 + 30_000)

      expect(presence.isOnline('u1', T0 + 60_000)).toBe(true)
      expect(presence.isOnline('u2', T0 + 60_000)).toBe(false)
    })
  })

  describe('typing', () => {
    it('shows typing right after the keystroke and stops showing it after a few seconds', () => {
      const presence = new PresenceService()
      presence.typing('c1', 'u1', T0)

      expect(presence.isTyping('c1', 'u1', T0 + TYPING_MS - 1)).toBe(true)
      expect(presence.isTyping('c1', 'u1', T0 + TYPING_MS)).toBe(false)
    })

    it('is per conversation and per person', () => {
      const presence = new PresenceService()
      presence.typing('c1', 'u1', T0)

      expect(presence.isTyping('c2', 'u1', T0)).toBe(false)
      expect(presence.isTyping('c1', 'u2', T0)).toBe(false)
    })

    it('stops at once when the message is sent', () => {
      const presence = new PresenceService()
      presence.typing('c1', 'u1', T0)
      presence.stopTyping('c1', 'u1')

      expect(presence.isTyping('c1', 'u1', T0)).toBe(false)
    })

    it('also counts as being connected', () => {
      const presence = new PresenceService()
      presence.typing('c1', 'u1', T0)

      expect(presence.isOnline('u1', T0 + 1_000)).toBe(true)
    })
  })
})
