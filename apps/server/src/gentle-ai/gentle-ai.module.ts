import { Module } from '@nestjs/common'
import { GENTLE_AI } from './gentle-ai.types.js'
import { NoopGentleAiOrchestrator } from './noop-gentle-ai.orchestrator.js'

@Module({
  providers: [{ provide: GENTLE_AI, useClass: NoopGentleAiOrchestrator }],
  exports: [GENTLE_AI],
})
export class GentleAiModule {}
