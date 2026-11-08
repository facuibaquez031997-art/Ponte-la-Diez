/**
 * Deletes the throwaway users created while testing (pending list #8, #9, #16, #17, #21, #23,
 * #24, #27) together with everything that hangs from them.
 *
 *   node scripts/cleanup-test-users.mjs            dry run: only prints what would be deleted
 *   node scripts/cleanup-test-users.mjs --apply    deletes it
 *
 * Safety: the emails are an explicit list (never a pattern), the database must be local, and
 * the script refuses to run if a listed user owns data it does not know how to clean
 * (a profile photo, courts or bookings).
 */
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))

const apply = process.argv.includes('--apply')

const fromStamps = (prefix, keys, stamps) =>
  keys.flatMap((key) => stamps.map((stamp) => `${prefix}.${key}.${stamp}@example.com`))

const TEST_EMAILS = [
  'test.client@example.com',
  'claude.test@example.com',
  't1.check.1793828121@example.com',
  ...fromStamps('t3', ['a', 'b', 'c', 'd'], [1793828679]),
  ...fromStamps('t4', ['a', 'b', 'c'], [1793830377]),
  ...fromStamps('t4b', ['a', 'b'], [1793830698]),
  ...fromStamps('t4c', ['a', 'b'], [1793831356]),
  ...fromStamps('t6', ['c', 'a', 'b', 'd', 'f', 'e'], [1794099785371]),
  ...fromStamps('t8', ['u1', 'u2', 'u3', 'u4'], [1794102346117, 1794102293426]),
  ...fromStamps('t12', ['a', 'b', 'c', 'o'], [1794103586549, 1794103644308]),
]

const databaseUrl = process.env.DATABASE_URL ?? ''
const host = databaseUrl.match(/@([^:/?]+)/)?.[1]
if (host !== 'localhost' && host !== '127.0.0.1') {
  console.error(`Refusing to run: DATABASE_URL points to "${host}", not to a local database.`)
  process.exit(1)
}

const prisma = new PrismaClient()

try {
  const users = await prisma.user.findMany({
    where: { email: { in: TEST_EMAILS } },
    select: { id: true, email: true, rol: true, avatarUrl: true },
  })
  const userIds = users.map((user) => user.id)

  const [canchas, reservas] = await Promise.all([
    prisma.cancha.count({ where: { ownerId: { in: userIds } } }),
    prisma.reserva.count({ where: { userId: { in: userIds } } }),
  ])
  const withPhoto = users.filter((user) => user.avatarUrl)
  if (canchas > 0 || reservas > 0 || withPhoto.length > 0) {
    console.error('Refusing to run: a listed user owns data this script does not clean.')
    console.error(`  courts: ${canchas}, bookings: ${reservas}, with photo: ${withPhoto.map((u) => u.email).join(', ') || 0}`)
    process.exit(1)
  }

  const convocatorias = await prisma.convocatoria.findMany({
    where: { creadorId: { in: userIds } },
    select: { id: true },
  })
  const convocatoriaIds = convocatorias.map((convocatoria) => convocatoria.id)

  // Inbox entries of anyone (including real accounts) that point to a call about to disappear
  // would be left dangling, so they go too.
  const notificationsWhere = {
    OR: [{ userId: { in: userIds } }, { convocatoriaId: { in: convocatoriaIds } }],
  }
  const contactsWhere = {
    OR: [{ solicitanteId: { in: userIds } }, { destinatarioId: { in: userIds } }],
  }
  const responsesWhere = {
    OR: [{ userId: { in: userIds } }, { convocatoriaId: { in: convocatoriaIds } }],
  }

  const counts = {
    users: users.length,
    'of which OWNER': users.filter((user) => user.rol === 'OWNER').length,
    convocatorias: convocatoriaIds.length,
    'respuestas (answers)': await prisma.respuestaConvocatoria.count({ where: responsesWhere }),
    contactos: await prisma.contacto.count({ where: contactsWhere }),
    notificaciones: await prisma.notificacion.count({ where: notificationsWhere }),
    'push subscriptions': await prisma.pushSubscription.count({ where: { userId: { in: userIds } } }),
  }

  console.log(apply ? 'DELETING:' : 'DRY RUN (nothing is deleted). It would delete:')
  console.table(counts)
  console.log(`Listed emails: ${TEST_EMAILS.length}. Found in the database: ${users.length}.`)
  const missing = TEST_EMAILS.filter((email) => !users.some((user) => user.email === email))
  if (missing.length > 0) console.log(`Not found (already gone): ${missing.length}`)

  if (!apply) {
    console.log('Run again with --apply to delete.')
  } else if (users.length > 0) {
    await prisma.$transaction([
      prisma.notificacion.deleteMany({ where: notificationsWhere }),
      prisma.respuestaConvocatoria.deleteMany({ where: responsesWhere }),
      prisma.contacto.deleteMany({ where: contactsWhere }),
      prisma.pushSubscription.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.convocatoria.deleteMany({ where: { creadorId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ])
    console.log('Done.')
  }
} finally {
  await prisma.$disconnect()
}
