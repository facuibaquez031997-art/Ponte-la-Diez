import { signOAuthState, verifyOAuthState } from './oauth-state.js'

const secret = 'test-secret-1234567890'
const now = new Date('2026-11-17T12:00:00Z')
const minutesLater = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

describe('oauth-state', () => {
  it('returns the owner id it was signed for', () => {
    const state = signOAuthState('owner-1', secret, now)
    expect(verifyOAuthState(state, secret, minutesLater(1))).toBe('owner-1')
  })

  it('refuses a state signed with another secret', () => {
    const state = signOAuthState('owner-1', 'another-secret-123456', now)
    expect(verifyOAuthState(state, secret, minutesLater(1))).toBeNull()
  })

  it('refuses a state whose owner id was swapped', () => {
    const [, expiresAt, signature] = signOAuthState('owner-1', secret, now).split('.')
    expect(
      verifyOAuthState(`owner-2.${expiresAt}.${signature}`, secret, minutesLater(1))
    ).toBeNull()
  })

  it('refuses a state whose expiry was extended', () => {
    const [ownerId, , signature] = signOAuthState('owner-1', secret, now).split('.')
    const extended = minutesLater(600).getTime()
    expect(
      verifyOAuthState(`${ownerId}.${extended}.${signature}`, secret, minutesLater(30))
    ).toBeNull()
  })

  it('refuses an expired state', () => {
    const state = signOAuthState('owner-1', secret, now)
    expect(verifyOAuthState(state, secret, minutesLater(11))).toBeNull()
  })

  it('refuses garbage', () => {
    expect(verifyOAuthState('not-a-state', secret, now)).toBeNull()
    expect(verifyOAuthState('', secret, now)).toBeNull()
  })
})
