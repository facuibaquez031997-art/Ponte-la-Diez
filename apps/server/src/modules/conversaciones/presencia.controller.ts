import { Controller, HttpCode, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { ConversacionesService } from './conversaciones.service.js'

@Controller('presencia')
export class PresenciaController {
  constructor(private readonly conversaciones: ConversacionesService) {}

  /** The app is open: the other people see this user as connected for the next 45 seconds. */
  @Post()
  @HttpCode(204)
  heartbeat(@CurrentUser() user: AuthUser): void {
    this.conversaciones.heartbeat(user.id)
  }
}
