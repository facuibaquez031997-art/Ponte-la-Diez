import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { RequestContactDto } from './request-contact.dto.js'

const parse = async (email: unknown) => {
  const dto = plainToInstance(RequestContactDto, { email })
  return { dto, errors: await validate(dto) }
}

describe('RequestContactDto', () => {
  it('accepts a plain email', async () => {
    const { errors } = await parse('ana@example.com')

    expect(errors).toEqual([])
  })

  it('trims the spaces a pasted email usually carries', async () => {
    const { dto, errors } = await parse('  ana@example.com ')

    expect(errors).toEqual([])
    expect(dto.email).toBe('ana@example.com')
  })

  it.each(['', 'ana', 'ana@', 42])('rejects %j', async (value) => {
    const { errors } = await parse(value)

    expect(errors.map((error) => error.property)).toEqual(['email'])
  })

  it('accepts a player id instead of an email', async () => {
    const dto = plainToInstance(RequestContactDto, {
      usuarioId: '3f2b8c1e-9d4a-4b6e-8f1a-2c7d5e9a0b13',
    })

    await expect(validate(dto)).resolves.toEqual([])
  })

  it('rejects a body with neither an email nor a player id', async () => {
    const errors = await validate(plainToInstance(RequestContactDto, {}))

    expect(errors.length).toBeGreaterThan(0)
  })

  it('rejects a player id that is not a UUID', async () => {
    const errors = await validate(plainToInstance(RequestContactDto, { usuarioId: 'ana' }))

    expect(errors.map((error) => error.property)).toEqual(['usuarioId'])
  })
})
