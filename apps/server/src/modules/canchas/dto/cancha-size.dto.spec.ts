import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { CreateCanchaDto } from './create-cancha.dto.js'
import { ListCanchasQuery } from './list-canchas.query.js'
import { UpdateCanchaDto } from './update-cancha.dto.js'

const valid = {
  nombre: 'La Bombonera',
  direccion: 'Calle 1 123',
  barrio: 'Barrio El Sol',
  tipoSuperficie: 'Sintético',
  precioHora: 12000,
  montoSena: 3000,
}
const create = (body: object) => validateSync(plainToInstance(CreateCanchaDto, body))
const update = (body: object) => validateSync(plainToInstance(UpdateCanchaDto, body))
const query = (body: object) => validateSync(plainToInstance(ListCanchasQuery, body))

describe('size of the court (players per side)', () => {
  describe('creating a court', () => {
    it.each([5, 7, 9, 11])('accepts a court of %i players', (jugadores) => {
      expect(create({ ...valid, jugadores })).toHaveLength(0)
    })

    it('requires the size', () => {
      expect(create(valid)).not.toHaveLength(0)
    })

    it.each([0, 6, 8, 10, 12, -5, 7.5, '7', null])('refuses %s', (jugadores) => {
      expect(create({ ...valid, jugadores })).not.toHaveLength(0)
    })

    it('says which sizes exist', () => {
      const [error] = create({ ...valid, jugadores: 6 })
      expect(Object.values(error.constraints ?? {})).toContain('jugadores debe ser 5, 7, 9 u 11')
    })
  })

  describe('editing a court', () => {
    it('does not require the size, so the other fields can change alone', () => {
      expect(update({ nombre: 'Otro nombre' })).toHaveLength(0)
    })

    it('accepts a valid size and refuses an invalid one', () => {
      expect(update({ jugadores: 11 })).toHaveLength(0)
      expect(update({ jugadores: 6 })).not.toHaveLength(0)
    })
  })

  describe('filtering the explore list', () => {
    it('reads the size from the query string, where everything is text', () => {
      const parsed = plainToInstance(ListCanchasQuery, { jugadores: '7' })
      expect(parsed.jugadores).toBe(7)
      expect(query({ jugadores: '7' })).toHaveLength(0)
    })

    it('works without the size and refuses one that does not exist', () => {
      expect(query({})).toHaveLength(0)
      expect(query({ jugadores: '6' })).not.toHaveLength(0)
      expect(query({ jugadores: 'siete' })).not.toHaveLength(0)
    })
  })
})
