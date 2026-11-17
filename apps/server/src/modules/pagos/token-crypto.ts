import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

function parseKey(hexKey: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
    throw new Error('The token encryption key must be 32 bytes written as 64 hex characters')
  }
  return Buffer.from(hexKey, 'hex')
}

/** Encrypts a credential for storage. Output is `iv.authTag.ciphertext`, all hex. */
export function encryptToken(plain: string, hexKey: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, parseKey(hexKey), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('hex')).join('.')
}

/** Reverses `encryptToken`. Throws when the key is wrong or the payload was altered. */
export function decryptToken(payload: string, hexKey: string): string {
  const [iv, authTag, encrypted] = payload.split('.').map((part) => Buffer.from(part, 'hex'))
  if (!iv || !authTag || !encrypted) throw new Error('Malformed encrypted token')

  const decipher = createDecipheriv(ALGORITHM, parseKey(hexKey), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
