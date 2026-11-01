import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { User } from '@prisma/client'
import bcrypt from 'bcrypt'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import type { JwtPayload } from './auth.types.js'
import type { AuthResponseDto, UserProfileDto } from './dto/auth-response.dto.js'
import type { LoginDto } from './dto/login.dto.js'
import type { RegisterDto } from './dto/register.dto.js'

const SALT_ROUNDS = 10

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const email = dto.email.trim().toLowerCase()
    const existing = await this.prisma.user.findUnique({ where: { email } })
    if (existing) throw new ConflictException('El email ya está registrado')

    const user = await this.prisma.user.create({
      data: {
        nombre: dto.nombre.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, SALT_ROUNDS),
        rol: dto.rol ?? 'PLAYER',
        telefono: dto.telefono,
        barrioPontevedra: dto.barrioPontevedra,
      },
    })
    return this.buildResponse(user)
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    })
    const valid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false
    if (!user || !valid) throw new UnauthorizedException('Credenciales inválidas')
    return this.buildResponse(user)
  }

  async me(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('Usuario no encontrado')
    return this.toProfile(user)
  }

  private async buildResponse(user: User): Promise<AuthResponseDto> {
    const payload: JwtPayload = { sub: user.id, email: user.email, rol: user.rol }
    return { accessToken: await this.jwt.signAsync(payload), user: this.toProfile(user) }
  }

  private toProfile(user: User): UserProfileDto {
    return {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      telefono: user.telefono,
      barrioPontevedra: user.barrioPontevedra,
    }
  }
}
