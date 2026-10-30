export interface EngramMemory {
  key: string
  content: string
  tags?: string[]
}

/** Contrato para persistir contexto del proyecto. Una implementación real se conecta en una fase posterior. */
export interface EngramClient {
  save(memory: EngramMemory): Promise<void>
  search(query: string, limit?: number): Promise<EngramMemory[]>
}

export const ENGRAM_CLIENT = Symbol('ENGRAM_CLIENT')
