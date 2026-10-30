import { Module } from '@nestjs/common'
import { ENGRAM_CLIENT } from './engram.types.js'
import { NoopEngramClient } from './noop-engram.client.js'

@Module({
  providers: [{ provide: ENGRAM_CLIENT, useClass: NoopEngramClient }],
  exports: [ENGRAM_CLIENT],
})
export class EngramModule {}
