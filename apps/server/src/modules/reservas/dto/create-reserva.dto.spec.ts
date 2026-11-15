import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { CreateReservaDto } from './create-reserva.dto.js'

const errors = (body: unknown) => validateSync(plainToInstance(CreateReservaDto, body))
const turnoId = '8f0c1f7e-3b9e-4c55-9d4b-0d6a5a3a9f11'

describe('CreateReservaDto', () => {
  it('accepts a slot id with SENA or TOTAL', () => {
    expect(errors({ turnoId, tipoPago: 'SENA' })).toHaveLength(0)
    expect(errors({ turnoId, tipoPago: 'TOTAL' })).toHaveLength(0)
  })

  it('refuses a missing or malformed slot id', () => {
    expect(errors({ tipoPago: 'SENA' })).not.toHaveLength(0)
    expect(errors({ turnoId: 'abc', tipoPago: 'SENA' })).not.toHaveLength(0)
  })

  it('refuses a missing or unknown payment choice', () => {
    expect(errors({ turnoId })).not.toHaveLength(0)
    expect(errors({ turnoId, tipoPago: 'MITAD' })).not.toHaveLength(0)
  })
})
