import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { CreatePreferenceDto } from './create-preference.dto.js'

const errors = (body: unknown) => validateSync(plainToInstance(CreatePreferenceDto, body))

describe('CreatePreferenceDto', () => {
  it('accepts a booking id', () => {
    expect(errors({ reservaId: '8f0c1f7e-3b9e-4c55-9d4b-0d6a5a3a9f11' })).toHaveLength(0)
  })

  it('refuses a missing or malformed booking id', () => {
    expect(errors({})).not.toHaveLength(0)
    expect(errors({ reservaId: 'abc' })).not.toHaveLength(0)
  })
})
