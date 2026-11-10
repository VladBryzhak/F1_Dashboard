import { describe, expect, it } from 'vitest'
import { eventText, localStory, storyParagraphs } from './raceStory'
import type { RaceStory } from '../types/f1'

const nor = { id: 'lando-norris', name: 'Lando Norris', code: 'NOR', constructorId: 'mclaren' }
const ver = { id: 'max-verstappen', name: 'Max Verstappen', code: 'VER', constructorId: 'red-bull' }
const odd = { id: 'ted-whiteaway', name: 'Ted Whiteaway', code: null, constructorId: 'hwm' }

const story = {
  totalLaps: 71,
  hasTiming: true,
  winner: { ...nor, team: 'McLaren', grid: 1 },
  second: ver,
  third: null,
  margin: '+14.602',
  lapsLed: [{ ...nor, laps: 71 }],
  startMovers: [],
  climbers: [],
  retirements: [{ ...odd, reason: 'Engine', lap: 12 }],
  fastest: null,
  championship: null,
  neutralisations: [],
  leadChanges: 0,
  stops: { winner: null, common: null },
  penalties: [],
  rain: false,
  events: [{ lap: 12, kind: 'dnf', driver: { ...odd, reason: 'Engine', lap: 12 }, reason: 'Engine' }],
} as unknown as RaceStory

describe('race story names', () => {
  it('names drivers in Ukrainian on Ukrainian pages, Latin for one the map lacks', () => {
    const uk = localStory(story, 'uk')
    expect(storyParagraphs(uk, 'uk')[0]).toContain('Перемога Ландо Норріс (McLaren)')
    expect(storyParagraphs(uk, 'uk')[0]).toContain('переваги над Макс Ферстаппен')
    expect(eventText(uk.events[0], 'uk')).toBe('Ted Whiteaway: сход, двигун')
  })

  it('leaves English pages as they are', () => {
    expect(localStory(story, 'en')).toBe(story)
  })
})
