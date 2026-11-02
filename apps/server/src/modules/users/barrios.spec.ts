import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { RegisterDto } from '../auth/dto/register.dto.js'
import { BARRIOS } from './barrios.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'

const baseRegister = { nombre: 'Juan Perez', email: 'juan@example.com', password: 'clave-segura-1' }

describe('BARRIOS', () => {
  it('lists the 34 neighborhoods, all prefixed with "Barrio " and without duplicates', () => {
    expect(BARRIOS).toHaveLength(34)
    expect(BARRIOS.every((barrio) => barrio.startsWith('Barrio '))).toBe(true)
    expect(new Set(BARRIOS).size).toBe(BARRIOS.length)
  })

  it('uses the confirmed spelling of "Veintisiete de Abril"', () => {
    expect(BARRIOS).toContain('Barrio Veintisiete de Abril')
  })
})

describe('RegisterDto barrioPontevedra', () => {
  it('accepts a known neighborhood', async () => {
    const dto = plainToInstance(RegisterDto, {
      ...baseRegister,
      barrioPontevedra: 'Barrio La Favela',
    })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('accepts a registration without neighborhood', async () => {
    expect(await validate(plainToInstance(RegisterDto, baseRegister))).toHaveLength(0)
  })

  it('rejects free text outside the list', async () => {
    const dto = plainToInstance(RegisterDto, { ...baseRegister, barrioPontevedra: 'centro' })
    const errors = await validate(dto)
    expect(errors.map((e) => e.property)).toEqual(['barrioPontevedra'])
  })
})

describe('UpdateProfileDto', () => {
  it('accepts a partial update with a known neighborhood', async () => {
    const dto = plainToInstance(UpdateProfileDto, { barrioPontevedra: 'Barrio El Edén' })
    expect(await validate(dto)).toHaveLength(0)
  })

  it('rejects an unknown neighborhood', async () => {
    const dto = plainToInstance(UpdateProfileDto, { barrioPontevedra: 'Barrio Inventado' })
    expect((await validate(dto)).map((e) => e.property)).toEqual(['barrioPontevedra'])
  })

  it('rejects a name that is too short', async () => {
    const dto = plainToInstance(UpdateProfileDto, { nombre: 'A' })
    expect((await validate(dto)).map((e) => e.property)).toEqual(['nombre'])
  })
})
