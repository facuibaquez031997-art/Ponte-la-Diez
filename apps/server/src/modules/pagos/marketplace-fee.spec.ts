import { computeMarketplaceFee } from './marketplace-fee.js'

describe('computeMarketplaceFee', () => {
  it('takes the percentage of the charged amount, in pesos', () => {
    expect(computeMarketplaceFee(5000, 10)).toBe(500)
    expect(computeMarketplaceFee(20000, 10)).toBe(2000)
  })

  it('rounds to the cent', () => {
    expect(computeMarketplaceFee(1234.55, 10)).toBe(123.46)
    expect(computeMarketplaceFee(333.33, 10)).toBe(33.33)
  })

  it('charges nothing when the percentage is zero', () => {
    expect(computeMarketplaceFee(5000, 0)).toBe(0)
  })

  it('refuses a percentage outside 0 to 100', () => {
    expect(() => computeMarketplaceFee(5000, -1)).toThrow()
    expect(() => computeMarketplaceFee(5000, 101)).toThrow()
    expect(() => computeMarketplaceFee(5000, Number.NaN)).toThrow()
  })
})
