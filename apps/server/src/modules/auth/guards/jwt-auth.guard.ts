import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { AuthenticatedRequest, JwtPayload } from '../auth.types.js'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>()
    const [type, token] = request.headers.authorization?.split(' ') ?? []
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido')

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token)
      request.user = { id: payload.sub, email: payload.email, rol: payload.rol }
    } catch {
      throw new UnauthorizedException('Token inválido o expirado')
    }
    return true
  }
}
