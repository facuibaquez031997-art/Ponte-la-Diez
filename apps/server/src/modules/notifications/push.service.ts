import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import webpush from 'web-push'

export interface PushPayload {
  title: string
  body: string
  url: string
}

export interface PushTarget {
  endpoint: string
  keysP256: string
  keysAuth: string
}

export type PushResult = 'sent' | 'gone' | 'failed'

const GONE_STATUS_CODES = [404, 410]

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name)
  private readonly publicKey?: string
  private readonly enabled: boolean

  constructor(config: ConfigService) {
    const publicKey = config.get<string>('VAPID_PUBLIC_KEY')
    const privateKey = config.get<string>('VAPID_PRIVATE_KEY')
    const subject = config.get<string>('VAPID_SUBJECT')

    this.enabled = Boolean(publicKey && privateKey && subject)
    if (publicKey && privateKey && subject) {
      webpush.setVapidDetails(subject, publicKey, privateKey)
      this.publicKey = publicKey
    } else {
      this.logger.warn('VAPID keys not configured: push notifications are disabled')
    }
  }

  getPublicKey(): string {
    if (!this.publicKey)
      throw new ServiceUnavailableException('Las notificaciones push no están configuradas')
    return this.publicKey
  }

  async send(target: PushTarget, payload: PushPayload): Promise<PushResult> {
    if (!this.enabled) return 'failed'

    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.keysP256, auth: target.keysAuth } },
        JSON.stringify(payload)
      )
      return 'sent'
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode
      if (statusCode !== undefined && GONE_STATUS_CODES.includes(statusCode)) return 'gone'
      this.logger.warn(`Push delivery failed (${statusCode ?? 'no status'})`)
      return 'failed'
    }
  }
}
