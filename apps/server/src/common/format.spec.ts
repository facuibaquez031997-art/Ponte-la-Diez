import { formatPesos, formatSlotLabel } from './format.js'

describe('formatSlotLabel', () => {
  it('writes the day and the hour in Argentina time with 24 hour clock', () => {
    // 20:00 UTC is 17:00 in Buenos Aires.
    const label = formatSlotLabel(new Date('2026-11-15T20:00:00.000Z'))
    expect(label).toContain('15 de noviembre')
    expect(label).toContain('17:00')
    expect(label).not.toMatch(/[ap]\. ?m\./i)
  })

  it('moves to the previous day when the Argentina hour is before midnight UTC', () => {
    // 02:00 UTC of the 16th is 23:00 of the 15th in Buenos Aires.
    const label = formatSlotLabel(new Date('2026-11-16T02:00:00.000Z'))
    expect(label).toContain('15 de noviembre')
    expect(label).toContain('23:00')
  })
})

describe('formatPesos', () => {
  it('writes whole pesos with the thousands separator', () => {
    expect(formatPesos(20000)).toMatch(/^\$\s?20\.000$/)
    expect(formatPesos(5000)).toMatch(/^\$\s?5\.000$/)
  })
})
