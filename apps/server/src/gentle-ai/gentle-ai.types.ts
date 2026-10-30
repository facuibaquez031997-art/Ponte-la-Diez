export interface GentleAiTask {
  name: string
  payload: Record<string, unknown>
}

export interface GentleAiResult {
  handled: boolean
  output?: string
}

/** Contrato del orquestador de agentes. Una implementación real se conecta en una fase posterior. */
export interface GentleAiOrchestrator {
  run(task: GentleAiTask): Promise<GentleAiResult>
}

export const GENTLE_AI = Symbol('GENTLE_AI')
