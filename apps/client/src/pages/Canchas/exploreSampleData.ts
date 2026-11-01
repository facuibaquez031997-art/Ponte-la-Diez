import type { NextMatch, OpenMatch, Venue } from '../../types/cancha'

// Placeholder data until the canchas/turnos/convocatorias modules exist (roadmap phases 2 and 4).

export const SAMPLE_VENUES: Venue[] = [
  {
    id: 'complejo-el-10',
    name: 'Complejo El 10',
    highlight: 'Premium turf',
    format: 'Fútbol 5',
    surface: 'Césped sintético pro',
    rating: 4.9,
    reviews: 142,
    address: 'Av. De la Unión 2120',
    distance: 'A 800 m del centro',
    pricePerHour: 28000,
    slots: [
      { time: '19:00', status: 'FREE' },
      { time: '20:30', status: 'FREE' },
      { time: '22:00', status: 'BUSY' },
    ],
  },
  {
    id: 'el-potrero-club',
    name: 'El Potrero Club',
    highlight: 'Seleccionado del mes',
    format: 'Fútbol 7',
    surface: 'Césped natural iluminado',
    rating: 4.8,
    reviews: 98,
    address: 'Calle Victoria 540',
    distance: 'A 1,6 km',
    pricePerHour: 42000,
    slots: [
      { time: '18:30', status: 'FREE' },
      { time: '20:00', status: 'BUSY' },
      { time: '21:30', status: 'FREE' },
    ],
  },
  {
    id: 'la-bombonera-chica',
    name: 'La Bombonera Chica',
    highlight: 'Techada',
    format: 'Fútbol 5',
    surface: 'Sintético techado',
    rating: 4.7,
    reviews: 76,
    address: 'Ruta 21 km 3',
    distance: 'A 2,4 km',
    pricePerHour: 25000,
    slots: [
      { time: '19:30', status: 'FREE' },
      { time: '21:00', status: 'BUSY' },
      { time: '22:30', status: 'BUSY' },
    ],
  },
]

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
