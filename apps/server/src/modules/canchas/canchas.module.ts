import { Module } from '@nestjs/common'
import { CanchasController } from './canchas.controller.js'
import { CanchasService } from './canchas.service.js'

@Module({
  controllers: [CanchasController],
  providers: [CanchasService],
  exports: [CanchasService],
})
export class CanchasModule {}
