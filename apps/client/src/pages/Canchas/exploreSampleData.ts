import type { NextMatch, OpenMatch } from '../../types/cancha'

// Placeholder data until reservations (phase 3) and the open matches feed exist.

export const SAMPLE_OPEN_MATCHES: OpenMatch[] = [
  {
    id: 'los-de-siempre',
    initials: 'LDS',
    teamName: 'Los de Siempre',
    level: 'Intermedio',
    venue: 'Complejo El 10 • Cancha 2 (F5)',
    when: 'Hoy 21:00 hs',
    joined: 8,
    total: 10,
    share: 2800,
  },
  {
    id: 'joga-bonito',
    initials: 'JB',
    teamName: 'Joga Bonito',
    level: 'Recreativo',
    venue: 'El Potrero Club • Cancha 1 (F7)',
    when: 'Mañana 20:00 hs',
    joined: 13,
    total: 14,
    share: 3000,
  },
]

export const SAMPLE_NEXT_MATCH: NextMatch = {
  date: 'Dom 18 mayo',
  time: '21:00 hs',
  venue: 'Complejo El 10 • Cancha 1 techada',
  confirmed: 10,
  playerInitials: ['LM', 'FR', 'NC', 'JP'],
}
