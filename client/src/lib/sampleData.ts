// Placeholder data shown ONLY when the live standings API is unreachable, so the
// UI/design is reviewable offline. It is always rendered behind a visible
// "sample data" banner and is replaced by real data the moment the API responds.

import type { ConstructorStanding, DriverStanding } from '../types/f1'

export const SAMPLE_DRIVER_STANDINGS: DriverStanding[] = [
  { position: 1, points: 161, wins: 2, driverId: 'piastri', givenName: 'Oscar', familyName: 'Piastri', nationality: 'Australian', permanentNumber: '81', code: 'PIA', constructorId: 'mclaren', constructorName: 'McLaren' },
  { position: 2, points: 158, wins: 3, driverId: 'norris', givenName: 'Lando', familyName: 'Norris', nationality: 'British', permanentNumber: '4', code: 'NOR', constructorId: 'mclaren', constructorName: 'McLaren' },
  { position: 3, points: 136, wins: 2, driverId: 'max_verstappen', givenName: 'Max', familyName: 'Verstappen', nationality: 'Dutch', permanentNumber: '1', code: 'VER', constructorId: 'red_bull', constructorName: 'Red Bull' },
  { position: 4, points: 99, wins: 0, driverId: 'russell', givenName: 'George', familyName: 'Russell', nationality: 'British', permanentNumber: '63', code: 'RUS', constructorId: 'mercedes', constructorName: 'Mercedes' },
  { position: 5, points: 94, wins: 0, driverId: 'leclerc', givenName: 'Charles', familyName: 'Leclerc', nationality: 'Monegasque', permanentNumber: '16', code: 'LEC', constructorId: 'ferrari', constructorName: 'Ferrari' },
  { position: 6, points: 71, wins: 0, driverId: 'hamilton', givenName: 'Lewis', familyName: 'Hamilton', nationality: 'British', permanentNumber: '44', code: 'HAM', constructorId: 'ferrari', constructorName: 'Ferrari' },
  { position: 7, points: 63, wins: 0, driverId: 'antonelli', givenName: 'Andrea Kimi', familyName: 'Antonelli', nationality: 'Italian', permanentNumber: '12', code: 'ANT', constructorId: 'mercedes', constructorName: 'Mercedes' },
  { position: 8, points: 37, wins: 0, driverId: 'albon', givenName: 'Alexander', familyName: 'Albon', nationality: 'Thai', permanentNumber: '23', code: 'ALB', constructorId: 'williams', constructorName: 'Williams' },
]

export const SAMPLE_CONSTRUCTOR_STANDINGS: ConstructorStanding[] = [
  { position: 1, points: 319, wins: 5, constructorId: 'mclaren', name: 'McLaren', nationality: 'British' },
  { position: 2, points: 165, wins: 0, constructorId: 'ferrari', name: 'Ferrari', nationality: 'Italian' },
  { position: 3, points: 162, wins: 2, constructorId: 'mercedes', name: 'Mercedes', nationality: 'German' },
  { position: 4, points: 144, wins: 2, constructorId: 'red_bull', name: 'Red Bull', nationality: 'Austrian' },
  { position: 5, points: 54, wins: 0, constructorId: 'williams', name: 'Williams', nationality: 'British' },
  { position: 6, points: 26, wins: 0, constructorId: 'haas', name: 'Haas F1 Team', nationality: 'American' },
]
