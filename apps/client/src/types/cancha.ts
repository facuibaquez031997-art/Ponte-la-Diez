export type MatchLevel = 'Recreativo' | 'Intermedio' | 'Competitivo'

export interface OpenMatch {
  id: string
  initials: string
  teamName: string
  level: MatchLevel
  venue: string
  when: string
  joined: number
  total: number
  share: number
}

export interface NextMatch {
  date: string
  time: string
  venue: string
  confirmed: number
  playerInitials: string[]
}
