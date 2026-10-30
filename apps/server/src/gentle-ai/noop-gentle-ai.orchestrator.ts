import { Injectable } from '@nestjs/common'
import type { GentleAiOrchestrator, GentleAiResult, GentleAiTask } from './gentle-ai.types.js'

@Injectable()
export class NoopGentleAiOrchestrator implements GentleAiOrchestrator {
  async run(_task: GentleAiTask): Promise<GentleAiResult> {
    return { handled: false }
  }
}
