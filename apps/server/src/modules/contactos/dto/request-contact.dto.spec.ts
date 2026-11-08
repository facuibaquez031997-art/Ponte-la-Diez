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
})
