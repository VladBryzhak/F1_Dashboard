import { describe, expect, it } from 'vitest'
import { previewFacts, skyKey } from './racePreview'
import type { RacePreview } from '../types/f1'

const base: RacePreview = {
  season: '2026',
  round: 20,
  race: {
    round: 20,
    grandPrixId: 'sao-paulo',
    name: 'São Paulo',
    officialName: '',
    date: '2026-11-08',
    circuitId: 'interlagos',
    circuitName: 'Autódromo José Carlos Pace',
    placeName: 'São Paulo',
    nationality: 'Brazilian',
    countryCode: 'br',
    winnerDriverId: null,
    winnerName: null,
    winnerConstructorId: null,
    winnerConstructorName: null,
    isSprint: false,
    sessions: [],
  },
  circuit: {
    id: 'interlagos',
    name: 'Autódromo José Carlos Pace',
    length: 4.309,
    turns: 15,
    racesHeld: 42,
    lapRecord: {
      time: '1:10.540',
      year: 2018,
      driverId: 'valtteri-bottas',
      driverName: 'Valtteri Bottas',
      constructorId: 'mercedes',
      constructorName: 'Mercedes',
    },
  },
  weather: [{ date: '2026-11-08', tMax: 19, tMin: 14, rain: 94, code: 53 }],
  history: [
    {
      year: 2025,
      round: 21,
      winnerId: 'lando-norris',
      winnerName: 'Lando Norris',
      winnerConstructorId: 'mclaren',
      winnerConstructorName: 'McLaren',
      poleName: 'Lando Norris',
    },
  ],
  topWinners: [],
  gridWinners: [
    { id: 'lewis-hamilton', name: 'Lewis Hamilton', count: 3 },
    { id: 'max-verstappen', name: 'Max Verstappen', count: 3 },
    { id: 'lando-norris', name: 'Lando Norris', count: 1 },
  ],
}

describe('previewFacts', () => {
  it('states the race-day forecast, the grid winners here and the lap record', () => {
    expect(previewFacts(base, 'uk').map((f) => f.text)).toEqual([
      'Неділя: мряка, 19°, ймовірність дощу 94%',
      'Льюїс Хемілтон і Макс Ферстаппен: по 3 перемоги тут',
      '1:10.540, Валттері Боттас, 2018',
    ])
    expect(previewFacts(base, 'en')[1].text).toBe('Lewis Hamilton and Max Verstappen: 3 wins each here')
  })

  it('falls back to the last race here without a forecast', () => {
    const facts = previewFacts({ ...base, weather: null }, 'en')
    expect(facts[0]).toEqual({ tag: 'pv.tag.last', text: '2025: Lando Norris, McLaren' })
  })

  it('handles a single winner, tied single wins, no winner and a new circuit', () => {
    const one = { ...base, gridWinners: [{ id: 'a', name: 'A', count: 2 }] }
    expect(previewFacts(one, 'uk')[1].text).toBe('A: 2 перемоги тут')
    const tied = {
      ...base,
      gridWinners: [
        { id: 'a', name: 'A', count: 1 },
        { id: 'b', name: 'B', count: 1 },
      ],
    }
    expect(previewFacts(tied, 'uk')[1].text).toBe('Перемоги тут уже мають A і B')
    expect(previewFacts({ ...base, gridWinners: [] }, 'en')[1].text).toBe(
      "No one on this year's grid has won here",
    )
    const fresh = { ...base, gridWinners: [], history: [], weather: null, circuit: { ...base.circuit, racesHeld: 0, lapRecord: null } }
    expect(previewFacts(fresh, 'en').map((f) => f.text)).toEqual(['The first F1 race at this circuit'])
  })

  it('reads the sky from WMO codes', () => {
    expect(skyKey(0)).toBe('pv.sky.clear')
    expect(skyKey(3)).toBe('pv.sky.cloudy')
    expect(skyKey(63)).toBe('pv.sky.rain')
    expect(skyKey(81)).toBe('pv.sky.showers')
    expect(skyKey(96)).toBe('pv.sky.storm')
  })
})
