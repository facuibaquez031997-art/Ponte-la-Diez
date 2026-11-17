import { decryptToken, encryptToken } from './token-crypto.js'

const key = 'a'.repeat(64)
const otherKey = 'b'.repeat(64)

describe('token-crypto', () => {
  it('decrypts what it encrypted', () => {
    expect(decryptToken(encryptToken('APP_USR-secret-token', key), key)).toBe(
      'APP_USR-secret-token'
    )
  })

  it('does not leave the token readable in the stored payload', () => {
    expect(encryptToken('APP_USR-secret-token', key)).not.toContain('APP_USR-secret-token')
  })

  it('produces a different payload on every call', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key))
  })

  it('refuses to decrypt with another key', () => {
    expect(() => decryptToken(encryptToken('token', key), otherKey)).toThrow()
  })

  it('refuses a tampered payload', () => {
    const payload = encryptToken('token', key)
    const tampered = `${payload.slice(0, -2)}${payload.endsWith('00') ? '11' : '00'}`
    expect(() => decryptToken(tampered, key)).toThrow()
  })

  it('refuses a key that is not 32 bytes of hex', () => {
    expect(() => encryptToken('token', 'too-short')).toThrow()
  })
})
