import { buildPreferenceBody } from './preference-body.js'

const input = {
  reservaId: 'r1',
  title: 'Reserva El Mate',
  monto: 5000,
  expiresAt: new Date('2026-11-14T15:15:00.000Z'),
}

describe('buildPreferenceBody', () => {
  it('charges one item for exactly the amount to pay now, in pesos', () => {
    const body = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173' })
    expect(body.items).toEqual([
      { id: 'r1', title: 'Reserva El Mate', quantity: 1, unit_price: 5000, currency_id: 'ARS' },
    ])
  })

  it('links the payment to the booking through external_reference', () => {
    const body = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173' })
    expect(body.external_reference).toBe('r1')
  })

  it('sends the player back to the client result page for every outcome', () => {
    const body = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173/' })
    const url = 'http://localhost:5173/reservas/resultado'
    expect(body.back_urls).toEqual({ success: url, pending: url, failure: url })
  })

  it('expires the checkout when the hold of the booking ends', () => {
    const body = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173' })
    expect(body.expires).toBe(true)
    expect(body.expiration_date_to).toBe('2026-11-14T15:15:00.000Z')
  })

  it('adds the webhook URL only when it is configured', () => {
    const without = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173' })
    expect(without).not.toHaveProperty('notification_url')
    const withUrl = buildPreferenceBody(input, {
      clientUrl: 'http://localhost:5173',
      notificationUrl: 'https://abc.ngrok.app/api/pagos/webhook',
    })
    expect(withUrl.notification_url).toBe('https://abc.ngrok.app/api/pagos/webhook')
  })

  it('asks for the automatic return only when the client URL is https', () => {
    const local = buildPreferenceBody(input, { clientUrl: 'http://localhost:5173' })
    expect(local).not.toHaveProperty('auto_return')
    const prod = buildPreferenceBody(input, { clientUrl: 'https://ponte-la-10.app' })
    expect(prod.auto_return).toBe('approved')
  })
})
