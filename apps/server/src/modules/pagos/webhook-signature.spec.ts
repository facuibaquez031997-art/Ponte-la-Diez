import { createHmac } from 'node:crypto'
import { verifyWebhookSignature } from './webhook-signature.js'

const secret = 'test-secret-123'
const sign = (manifest: string, key = secret) =>
  createHmac('sha256', key).update(manifest).digest('hex')

const input = (overrides: object = {}) => ({
  xSignature: `ts=1700000000000,v1=${sign('id:123456;request-id:req-1;ts:1700000000000;')}`,
  xRequestId: 'req-1',
  dataId: '123456',
  secret,
  ...overrides,
})

describe('verifyWebhookSignature', () => {
  it('accepts a notification signed with the secret', () => {
    expect(verifyWebhookSignature(input())).toBe(true)
  })

  it('refuses a signature made with another secret', () => {
    expect(verifyWebhookSignature(input({ secret: 'another-secret' }))).toBe(false)
  })

  it('refuses when the payment id was tampered with', () => {
    expect(verifyWebhookSignature(input({ dataId: '999999' }))).toBe(false)
  })

  it('refuses when the request id was tampered with', () => {
    expect(verifyWebhookSignature(input({ xRequestId: 'req-2' }))).toBe(false)
  })

  it('refuses when the timestamp was tampered with', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1700000000000;')
    expect(verifyWebhookSignature(input({ xSignature: `ts=1700000000001,v1=${v1}` }))).toBe(false)
  })

  it('refuses a missing, empty or malformed header without throwing', () => {
    expect(verifyWebhookSignature(input({ xSignature: undefined }))).toBe(false)
    expect(verifyWebhookSignature(input({ xSignature: '' }))).toBe(false)
    expect(verifyWebhookSignature(input({ xSignature: 'garbage' }))).toBe(false)
    expect(verifyWebhookSignature(input({ xSignature: 'ts=1700000000000' }))).toBe(false)
    expect(verifyWebhookSignature(input({ xSignature: 'v1=abc' }))).toBe(false)
  })

  it('refuses a hash of a different length or with non hexadecimal characters', () => {
    expect(verifyWebhookSignature(input({ xSignature: 'ts=1700000000000,v1=abc' }))).toBe(false)
    expect(
      verifyWebhookSignature(input({ xSignature: `ts=1700000000000,v1=${'z'.repeat(64)}` }))
    ).toBe(false)
  })

  it('leaves the request id out of the manifest when the header is absent', () => {
    const v1 = sign('id:123456;ts:1700000000000;')
    const xSignature = `ts=1700000000000,v1=${v1}`
    expect(verifyWebhookSignature(input({ xSignature, xRequestId: undefined }))).toBe(true)
  })

  it('lowercases an alphanumeric payment id like Mercado Pago does', () => {
    const v1 = sign('id:abc123;request-id:req-1;ts:1700000000000;')
    const xSignature = `ts=1700000000000,v1=${v1}`
    expect(verifyWebhookSignature(input({ xSignature, dataId: 'ABC123' }))).toBe(true)
  })

  it('refuses everything when there is no secret', () => {
    expect(verifyWebhookSignature(input({ secret: undefined }))).toBe(false)
    expect(verifyWebhookSignature(input({ secret: '' }))).toBe(false)
  })
})
