import type { AppNotification } from '../../types/notifications'

const CONVOCATORIAS_PATH = '/convocatorias'
const CONTACTOS_PATH = '/contactos'

/**
 * Screen a notification belongs to. Only call notifications carry a `convocatoriaId`; the rest
 * are contact requests and acceptances. A new kind of notification needs its own rule here.
 */
export const notificationTarget = (notification: AppNotification): string =>
  notification.convocatoriaId ? CONVOCATORIAS_PATH : CONTACTOS_PATH
