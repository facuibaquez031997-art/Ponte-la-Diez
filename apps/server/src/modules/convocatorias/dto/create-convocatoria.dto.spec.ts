import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { CreateConvocatoriaDto } from './create-convocatoria.dto.js'

const validPayload = {
  fechaHora: new Date(Date.now() + 86_400_000).toISOString(),
  posicion: 'ARQUERO',
  jugadoresFaltantes: 1,
}

const errorsFor = async (overrides: Record<string, unknown>) => {
  const dto = plainToInstance(CreateConvocatoriaDto, { ...validPayload, ...overrides })
  const errors = await validate(dto)
  return errors.map((error) => error.property)
}

describe('CreateConvocatoriaDto', () => {
  it('accepts a valid payload', async () => {
    await expect(errorsFor({})).resolves.toEqual([])
  })

  it('accepts "TODOS" as the missing position', async () => {
    await expect(errorsFor({ posicion: 'TODOS' })).resolves.toEqual([])
  })

  it('rejects an unknown position', async () => {
    await expect(errorsFor({ posicion: 'ENTRENADOR' })).resolves.toEqual(['posicion'])
  })

  it('accepts up to 11 missing players', async () => {
    await expect(errorsFor({ jugadoresFaltantes: 11 })).resolves.toEqual([])
  })

  it.each([0, 12])('rejects %i missing players', async (count) => {
    await expect(errorsFor({ jugadoresFaltantes: count })).resolves.toEqual(['jugadoresFaltantes'])
  })
})
