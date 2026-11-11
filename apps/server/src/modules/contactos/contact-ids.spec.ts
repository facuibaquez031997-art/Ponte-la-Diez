import { vi } from 'vitest'
import { acceptedContactIds } from './contact-ids.js'

describe('acceptedContactIds', () => {
  it('returns the other side of every accepted contact, whoever sent the request', async () => {
    const prisma = {
      contacto: {
        findMany: vi.fn(async (_args?: object) => [
          { solicitanteId: 'u1', destinatarioId: 'u2' },
          { solicitanteId: 'u3', destinatarioId: 'u1' },
        ]),
      },
    }

    await expect(acceptedContactIds(prisma as never, 'u1')).resolves.toEqual(['u2', 'u3'])
    expect(prisma.contacto.findMany).toHaveBeenCalledWith({
      where: {
        estado: 'ACEPTADO',
        OR: [{ solicitanteId: 'u1' }, { destinatarioId: 'u1' }],
      },
      select: { solicitanteId: true, destinatarioId: true },
    })
  })

  it('returns an empty list when the player has no contacts', async () => {
    const prisma = { contacto: { findMany: vi.fn(async (_args?: object) => []) } }

    await expect(acceptedContactIds(prisma as never, 'u1')).resolves.toEqual([])
  })
})
