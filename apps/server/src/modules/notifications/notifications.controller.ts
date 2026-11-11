import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import type { Notificacion } from '@prisma/client'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { SubscribePushDto, UnsubscribePushDto } from './dto/subscribe-push.dto.js'
import { NotificationsService } from './notifications.service.js'
import { PushService } from './push.service.js'

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService
  ) {}

  @Get('push/public-key')
  publicKey(): { publicKey: string } {
    return { publicKey: this.push.getPublicKey() }
  }

  @Post('push/subscription')
  @HttpCode(204)
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: SubscribePushDto): Promise<void> {
    return this.notifications.subscribe(user.id, dto)
  }

  @Delete('push/subscription')
  @HttpCode(204)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: UnsubscribePushDto): Promise<void> {
    return this.notifications.unsubscribe(user.id, dto.endpoint)
  }

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<Notificacion[]> {
    return this.notifications.list(user.id)
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: AuthUser): Promise<{ count: number }> {
    return this.notifications.unreadCount(user.id)
  }

  @Patch('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.id)
  }

  @Patch(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.markRead(user.id, id)
  }
}
