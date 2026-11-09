import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { HealthModule } from './common/health/health.module.js'
import { PrismaModule } from './common/prisma/prisma.module.js'
import { validateEnv } from './config/env.config.js'
import { EngramModule } from './engram/engram.module.js'
import { GentleAiModule } from './gentle-ai/gentle-ai.module.js'
import { AuthModule } from './modules/auth/auth.module.js'
import { CanchasModule } from './modules/canchas/canchas.module.js'
import { ContactosModule } from './modules/contactos/contactos.module.js'
import { ConvocatoriasModule } from './modules/convocatorias/convocatorias.module.js'
import { NotificationsModule } from './modules/notifications/notifications.module.js'
import { UsersModule } from './modules/users/users.module.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CanchasModule,
    ContactosModule,
    ConvocatoriasModule,
    NotificationsModule,
    EngramModule,
    GentleAiModule,
  ],
})
export class AppModule {}
