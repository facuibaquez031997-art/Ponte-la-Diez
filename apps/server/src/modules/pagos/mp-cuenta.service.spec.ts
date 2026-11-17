import 'reflect-metadata'
import { vi } from 'vitest'
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { MpCuentaService } from './mp-cuenta.service.js'
import { signOAuthState } from './oauth-state.js'
import { decryptToken, encryptToken } from './token-crypto.js'

const now = new Date('2026-11-17T12:00:00.000Z')
const secret = 'jwt-secret-1234567890'
const key = 'a'.repeat(64)
const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

const tokens = (overrides: object = {}) => ({
  mpUserId: '998877',
  accessToken: 'APP_USR-new-access',
  refreshToken: 'TG-new-refresh',
  expiresAt: inMinutes(60 * 24 * 180),
  ...overrides,
})

const setup = (user: object | null = { id: 'o1', rol: 'OWNER' }) => {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(user) },
    mpCuenta: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  }
  const oauth = {
    isConfigured: vi.fn().mockReturnValue(true),
    getAuthorizationUrl: vi.fn((state: string) => `https://auth.example/authorize?state=${state}`),
    exchangeCode: vi.fn().mockResolvedValue(tokens()),
    refresh: vi.fn().mockResolvedValue(tokens({ accessToken: 'APP_USR-refreshed' })),
  }
  const values: Record<string, string> = { JWT_SECRET: secret, MP_TOKEN_ENCRYPTION_KEY: key }
  const config = { get: (name: string) => values[name] }
  const service = new MpCuentaService(prisma as never, oauth as never, config as never)
  return { service, prisma, oauth }
}

const linkedAccount = (expiresAt: Date) => ({
  userId: 'o1',
  accessTokenEnc: encryptToken('APP_USR-stored-access', key),
  refreshTokenEnc: encryptToken('TG-stored-refresh', key),
  expiresAt,
})

describe('MpCuentaService.getAuthorizeUrl', () => {
  it('returns the Mercado Pago consent URL carrying a state signed for the owner', () => {
    const { service, oauth } = setup()
    const { url } = service.getAuthorizeUrl('o1', now)
    const state = new URL(url).searchParams.get('state') as string
    expect(oauth.getAuthorizationUrl).toHaveBeenCalledWith(state)
    expect(state.startsWith('o1.')).toBe(true)
  })

  it('fails with 503 when the marketplace credentials are not configured', () => {
    const { service, oauth } = setup()
    oauth.isConfigured.mockReturnValue(false)
    expect(() => service.getAuthorizeUrl('o1', now)).toThrow(ServiceUnavailableException)
  })
})

describe('MpCuentaService.handleCallback', () => {
  const validState = () => signOAuthState('o1', secret, now)

  it('links the account and stores both tokens encrypted', async () => {
    const { service, oauth, prisma } = setup()

    await expect(service.handleCallback({ code: 'abc', state: validState() }, now)).resolves.toBe(
      'linked'
    )

    expect(oauth.exchangeCode).toHaveBeenCalledWith('abc', now)
    const [[{ create, update, where }]] = prisma.mpCuenta.upsert.mock.calls
    expect(where).toEqual({ userId: 'o1' })
    expect(create.mpUserId).toBe('998877')
    expect(decryptToken(create.accessTokenEnc, key)).toBe('APP_USR-new-access')
    expect(decryptToken(create.refreshTokenEnc, key)).toBe('TG-new-refresh')
    expect(update.accessTokenEnc).not.toContain('APP_USR-new-access')
  })

  it('does nothing when the state was forged', async () => {
    const { service, oauth, prisma } = setup()
    const forged = signOAuthState('o1', 'another-secret-123456', now)

    await expect(service.handleCallback({ code: 'abc', state: forged }, now)).resolves.toBe(
      'invalid'
    )

    expect(oauth.exchangeCode).not.toHaveBeenCalled()
    expect(prisma.mpCuenta.upsert).not.toHaveBeenCalled()
  })

  it('does nothing when the owner declined on the consent screen', async () => {
    const { service, oauth, prisma } = setup()

    await expect(
      service.handleCallback({ error: 'access_denied', state: validState() }, now)
    ).resolves.toBe('denied')

    expect(oauth.exchangeCode).not.toHaveBeenCalled()
    expect(prisma.mpCuenta.upsert).not.toHaveBeenCalled()
  })

  it('refuses to link a user that is not an owner', async () => {
    const { service, oauth } = setup({ id: 'o1', rol: 'PLAYER' })

    await expect(service.handleCallback({ code: 'abc', state: validState() }, now)).resolves.toBe(
      'invalid'
    )

    expect(oauth.exchangeCode).not.toHaveBeenCalled()
  })

  it('reports an error when Mercado Pago rejects the code', async () => {
    const { service, oauth, prisma } = setup()
    oauth.exchangeCode.mockRejectedValue(new Error('invalid_grant'))

    await expect(service.handleCallback({ code: 'bad', state: validState() }, now)).resolves.toBe(
      'error'
    )

    expect(prisma.mpCuenta.upsert).not.toHaveBeenCalled()
  })
})

describe('MpCuentaService.getAccessToken', () => {
  it('returns the stored token without refreshing while it is far from expiring', async () => {
    const { service, oauth, prisma } = setup()
    prisma.mpCuenta.findUnique.mockResolvedValue(linkedAccount(inMinutes(60 * 24 * 30)))

    await expect(service.getAccessToken('o1', now)).resolves.toBe('APP_USR-stored-access')

    expect(oauth.refresh).not.toHaveBeenCalled()
  })

  it('refreshes the token when it is about to expire and keeps the new pair encrypted', async () => {
    const { service, oauth, prisma } = setup()
    prisma.mpCuenta.findUnique.mockResolvedValue(linkedAccount(inMinutes(2)))

    await expect(service.getAccessToken('o1', now)).resolves.toBe('APP_USR-refreshed')

    expect(oauth.refresh).toHaveBeenCalledWith('TG-stored-refresh', now)
    const [[{ data, where }]] = prisma.mpCuenta.update.mock.calls
    expect(where).toEqual({ userId: 'o1' })
    expect(decryptToken(data.accessTokenEnc, key)).toBe('APP_USR-refreshed')
    expect(decryptToken(data.refreshTokenEnc, key)).toBe('TG-new-refresh')
  })

  it('fails when the owner has not linked a Mercado Pago account', async () => {
    const { service, prisma } = setup()
    prisma.mpCuenta.findUnique.mockResolvedValue(null)

    await expect(service.getAccessToken('o1', now)).rejects.toThrow(NotFoundException)
  })
})
