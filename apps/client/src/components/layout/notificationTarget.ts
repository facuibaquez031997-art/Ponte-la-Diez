import type { AppNotification } from '../../types/notifications'

const CONVOCATORIAS_PATH = '/convocatorias'
const CONTACTOS_PATH = '/contactos'
const OWNER_RESERVAS_PATH = '/dueno/reservas'

/**
 * Screen a notification belongs to. Call notifications carry a `convocatoriaId`, the ones for an
 * owner carry a `reservaId`; the rest are contact requests and acceptances. A new kind of
 * notification needs its own rule here.
 */
export const notificationTarget = (notification: AppNotification): string => {
  if (notification.reservaId) return OWNER_RESERVAS_PATH
  return notification.convocatoriaId ? CONVOCATORIAS_PATH : CONTACTOS_PATH
}
