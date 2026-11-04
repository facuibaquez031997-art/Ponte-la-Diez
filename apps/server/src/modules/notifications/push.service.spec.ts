import 'reflect-metadata'
import { vi } from 'vitest'
import { ServiceUnavailableException } from '@nestjs/common'

const webpush = vi.hoisted(() => ({
  setVapidDetails: vi.fn(),
  sendNotification: vi.fn(),
}))
vi.mock('web-push', () => ({ default: webpush }))

import { PushService } from './push.service.js'

const configured = {
  VAPID_PUBLIC_KEY: 'public-key',
  VAPID_PRIVATE_KEY: 'private-key',
  VAPID_SUBJECT: 'mailto:test@example.com',
}

const makeService = (env: Record<string, string> = configured) =>
  new PushService({ get: (key: string) => env[key] } as never)

const subscription = { endpoint: 'https://push.example/e1', keysP256: 'p', keysAuth: 'a' }
const payload = { title: 't', body: 'b', url: '/' }

beforeEach(() => {
  webpush.setVapidDetails.mockReset()
  webpush.sendNotification.mockReset()
})

describe('PushService', () => {
  it('sends the payload as JSON with the subscription keys', async () => {
    webpush.sendNotification.mockResolvedValue({})

    await expect(makeService().send(subscription, payload)).resolves.toBe('sent')

    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: subscription.endpoint, keys: { p256dh: 'p', auth: 'a' } },
      JSON.stringify(payload)
    )
  })

  it.each([404, 410])('reports status %i as gone', async (statusCode) => {
    webpush.sendNotification.mockRejectedValue({ statusCode })

    await expect(makeService().send(subscription, payload)).resolves.toBe('gone')
  })

  it('reports any other error as failed without throwing', async () => {
    webpush.sendNotification.mockRejectedValue(new Error('boom'))

    await expect(makeService().send(subscription, payload)).resolves.toBe('failed')
  })

  it('does not send when VAPID keys are missing', async () => {
    await expect(makeService({}).send(subscription, payload)).resolves.toBe('failed')
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })

  it('exposes the public key, or 503 when not configured', () => {
    expect(makeService().getPublicKey()).toBe('public-key')
    expect(() => makeService({}).getPublicKey()).toThrow(ServiceUnavailableException)
  })
})
