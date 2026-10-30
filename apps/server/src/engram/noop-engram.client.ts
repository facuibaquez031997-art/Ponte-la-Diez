import { Injectable } from '@nestjs/common'
import type { EngramClient, EngramMemory } from './engram.types.js'

@Injectable()
export class NoopEngramClient implements EngramClient {
  async save(_memory: EngramMemory): Promise<void> {}

  async search(_query: string, _limit?: number): Promise<EngramMemory[]> {
    return []
  }
}
