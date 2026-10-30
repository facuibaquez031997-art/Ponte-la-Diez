import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'
import { HealthResponseDto } from './health-response.dto.js'

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponseDto> {
    let database: HealthResponseDto['database'] = 'up'
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      database = 'down'
    }
    return { status: 'ok', database, timestamp: new Date().toISOString() }
  }
}
