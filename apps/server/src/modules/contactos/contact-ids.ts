import type { PrismaService } from '../../common/prisma/prisma.service.js'

/** Ids of the players with an accepted contact relation with `userId`, whoever sent the request. */
export const acceptedContactIds = async (
  prisma: Pick<PrismaService, 'contacto'>,
  userId: string
): Promise<string[]> => {
  const rows = await prisma.contacto.findMany({
    where: {
      estado: 'ACEPTADO',
      OR: [{ solicitanteId: userId }, { destinatarioId: userId }],
    },
    select: { solicitanteId: true, destinatarioId: true },
  })
  return rows.map((row) => (row.solicitanteId === userId ? row.destinatarioId : row.solicitanteId))
}
