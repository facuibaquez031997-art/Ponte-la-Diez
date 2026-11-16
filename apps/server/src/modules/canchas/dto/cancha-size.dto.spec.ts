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

  describe('how many courts of that size there are', () => {
    it('is optional when creating: one court if left out', () => {
      expect(create({ ...valid, jugadores: 5 })).toHaveLength(0)
    })

    it.each([1, 2, 3, 10])('accepts %i courts', (cantidad) => {
      expect(create({ ...valid, jugadores: 5, cantidad })).toHaveLength(0)
      expect(update({ cantidad })).toHaveLength(0)
    })

    it.each([0, -1, 11, 2.5, '2', null])('refuses %s', (cantidad) => {
      expect(create({ ...valid, jugadores: 5, cantidad })).not.toHaveLength(0)
      expect(update({ cantidad })).not.toHaveLength(0)
    })
  })

  describe('the entries that share the physical space', () => {
    const id = '8f0c1f7e-3b9e-4c55-9d4b-0d6a5a3a9f11'
    const other = '3a1f6d52-7c41-4a7e-8b0e-5d2c1e9f4a22'

    it('is optional: leaving it out changes nothing', () => {
      expect(create({ ...valid, jugadores: 5 })).toHaveLength(0)
      expect(update({ nombre: 'Otro nombre' })).toHaveLength(0)
    })

    it('accepts a list of links, or an empty list to remove them', () => {
      const links = [{ canchaId: id }, { canchaId: other, numero: 1, otraNumero: 0 }]
      expect(create({ ...valid, jugadores: 5, comparteCon: links })).toHaveLength(0)
      expect(update({ comparteCon: [{ canchaId: id, numero: 2 }] })).toHaveLength(0)
      expect(update({ comparteCon: [] })).toHaveLength(0)
    })

    it('accepts the courts of each entry from 0 (all of them) to 10', () => {
      expect(update({ comparteCon: [{ canchaId: id, numero: 0, otraNumero: 10 }] })).toHaveLength(0)
      expect(update({ comparteCon: [{ canchaId: id, numero: 11 }] })).not.toHaveLength(0)
      expect(update({ comparteCon: [{ canchaId: id, otraNumero: 11 }] })).not.toHaveLength(0)
    })

    it.each([[-1], [2.5], ['1'], [null]])('refuses a court number of %s', (numero) => {
      expect(update({ comparteCon: [{ canchaId: id, numero }] })).not.toHaveLength(0)
      expect(update({ comparteCon: [{ canchaId: id, otraNumero: numero }] })).not.toHaveLength(0)
    })

    it.each([
      ['nope'],
      [[{ canchaId: 'nope' }]],
      [[{}]],
      [[id]],
      [[1]],
      [null],
      [{ canchaId: id }],
    ])('refuses %j', (comparteCon) => {
      expect(create({ ...valid, jugadores: 5, comparteCon })).not.toHaveLength(0)
      expect(update({ comparteCon })).not.toHaveLength(0)
    })

    it('refuses an absurd number of links', () => {
      expect(
        update({ comparteCon: Array.from({ length: 51 }, () => ({ canchaId: id })) })
      ).not.toHaveLength(0)
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

    it('does not let the size be cleared with null', () => {
      expect(update({ jugadores: null })).not.toHaveLength(0)
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
