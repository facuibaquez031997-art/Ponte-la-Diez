export type SlotStatus = 'FREE' | 'BUSY'

export interface TimeSlot {
  time: string
  status: SlotStatus
}

export interface Venue {
  id: string
  name: string
  highlight: string
  format: string
  surface: string
  rating: number
  reviews: number
  address: string
  distance: string
  pricePerHour: number
  slots: TimeSlot[]
}

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
