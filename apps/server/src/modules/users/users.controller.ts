import { Body, Controller, Get, Patch } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Public } from '../auth/decorators/public.decorator.js'
import type { UserProfileDto } from '../auth/dto/auth-response.dto.js'
import { BARRIOS } from './barrios.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import { UsersService } from './users.service.js'

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @Get('barrios')
  barrios(): readonly string[] {
    return BARRIOS
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserProfileDto> {
    return this.users.updateProfile(user.id, dto)
  }
}
