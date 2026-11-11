import { Module } from '@nestjs/common'
import { AvatarService } from './avatar/avatar.service.js'
import { UsersController } from './users.controller.js'
import { UsersService } from './users.service.js'

@Module({
  controllers: [UsersController],
  providers: [UsersService, AvatarService],
})
export class UsersModule {}
