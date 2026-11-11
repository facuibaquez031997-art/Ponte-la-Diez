import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service.js'
import { TurnosService } from '../turnos/turnos.service.js'
import { type FranjaInput, formatMinutes, normalizeFranjas } from './horarios.js'

@Injectable()
export class HorariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly turnos: TurnosService
  ) {}

  async get(canchaId: string): Promise<FranjaInput[]> {
    await this.findCancha(canchaId)
    const rows = await this.prisma.horarioCancha.findMany({
      where: { canchaId },
      orderBy: [{ diaSemana: 'asc' }, { minutoInicio: 'asc' }],
    })
    return rows.map((row) => ({
      dia: row.diaSemana,
      desde: formatMinutes(row.minutoInicio),
      hasta: formatMinutes(row.minutoFin),
    }))
  }

  async replace(ownerId: string, canchaId: string, franjas: FranjaInput[]): Promise<FranjaInput[]> {
    const cancha = await this.findCancha(canchaId)
    if (cancha.ownerId !== ownerId) throw new ForbiddenException('Esta cancha no es tuya')

    const rows = normalizeFranjas(franjas)
    await this.prisma.$transaction(async (tx) => {
      await tx.horarioCancha.deleteMany({ where: { canchaId } })
      if (rows.length > 0) {
        await tx.horarioCancha.createMany({ data: rows.map((row) => ({ canchaId, ...row })) })
      }
    })
    await this.turnos.sync(canchaId)
    return this.get(canchaId)
  }

  private async findCancha(canchaId: string): Promise<{ id: string; ownerId: string }> {
    const cancha = await this.prisma.cancha.findUnique({ where: { id: canchaId } })
    if (!cancha) throw new NotFoundException('La cancha no existe')
    return cancha
  }
}
