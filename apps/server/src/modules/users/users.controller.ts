import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common'
import type { AuthUser } from '../auth/auth.types.js'
import { CurrentUser } from '../auth/decorators/current-user.decorator.js'
import { Public } from '../auth/decorators/public.decorator.js'
import type { UserProfileDto } from '../auth/dto/auth-response.dto.js'
import { AvatarService } from './avatar/avatar.service.js'
import type { UploadSignatureDto } from './avatar/dto/upload-signature.dto.js'
import { BARRIOS } from './barrios.js'
import { UpdateProfileDto } from './dto/update-profile.dto.js'
import { UsersService } from './users.service.js'

@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly avatar: AvatarService
  ) {}

  @Public()
  @Get('barrios')
  barrios(): readonly string[] {
    return BARRIOS
  }

  @Patch('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<UserProfileDto> {
    return this.users.updateProfile(user.id, dto)
  }

  @Post('me/avatar/signature')
  @HttpCode(200)
  avatarSignature(@CurrentUser() user: AuthUser): UploadSignatureDto {
    return this.avatar.createUploadSignature(user.id)
  }

  @Post('me/avatar')
  @HttpCode(200)
  confirmAvatar(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.avatar.confirmUpload(user.id)
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: AuthUser): Promise<UserProfileDto> {
    return this.avatar.removeAvatar(user.id)
  }
}
