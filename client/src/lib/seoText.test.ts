import { describe, expect, it } from 'vitest'
import { seoText } from './seoText'
import { CURRENT_SEASON } from './seasons'
import type { ConstructorProfile, DriverProfile, DriverStanding } from '../types/f1'

const season = (year: number, constructorName: string) => ({ season: year, constructorId: constructorName.toLowerCase(), constructorName, position: 1, points: 0, wins: 0 })

const senna = {
  driverId: 'ayrton-senna', givenName: 'Ayrton', familyName: 'Senna',
  firstSeason: 1984, lastSeason: 1994, championships: 3, wins: 41, podiums: 80, races: 161,
  seasons: [season(1984, 'Toleman'), season(1985, 'Lotus'), season(1988, 'McLaren'), season(1993, 'McLaren'), season(1994, 'Williams')],
} as unknown as DriverProfile

describe('seoText', () => {
  it('names a driver\'s teams in order, with the career numbers', () => {
    expect(seoText.driver(senna, 'en')).toEqual({
      title: 'Ayrton Senna: F1 Career Stats, Wins & Teams',
      description: 'Ayrton Senna raced in Formula 1 from 1984 to 1994, for Toleman, Lotus, McLaren and Williams: 3 world titles, 41 wins, 80 podiums and 161 race starts.',
    })
    expect(seoText.driver(senna, 'uk')).toEqual({
      title: 'Айртон Сенна: статистика, перемоги й команди у Ф1',
      description: 'Айртон Сенна у Формулі-1 у 1984-1994 роках, команди Toleman, Lotus, McLaren і Williams: 3 титули чемпіона світу, 41 перемога в Гран-прі, 80 подіумів і 161 гонка.',
    })
  })

  it('says "since" for a driver still racing', () => {
    const now = { ...senna, firstSeason: 2018, lastSeason: CURRENT_SEASON } as DriverProfile
    expect(seoText.driver(now, 'en').description).toMatch(/^Ayrton Senna has raced in Formula 1 since 2018, for /)
  })

  it('counts a single win as one', () => {
    const rp = { name: 'Racing Point', championships: 0, wins: 1, podiums: 4, races: 38, firstSeason: 2019 } as ConstructorProfile
    expect(seoText.team(rp, 'en').description).toBe("Racing Point in Formula 1: 0 constructors' titles, 1 win, 4 podiums and 38 races since 2019.")
  })

  it('puts a past season\'s champion in the standings description', () => {
    const ham = { driverId: 'lewis-hamilton', givenName: 'Lewis', familyName: 'Hamilton', points: 408 } as DriverStanding
    expect(seoText.standings('2018', 'en', ham).description).toMatch(/^Lewis Hamilton won the 2018 title with 408 points\. /)
    expect(seoText.standings('2018', 'uk', ham)).toMatchObject({
      title: 'Турнірна таблиця Ф1 2018: залік пілотів і конструкторів',
      description: expect.stringMatching(/^Чемпіон 2018 року: Льюїс Хемілтон, 408 очок\. /),
    })
    expect(seoText.standings('2018', 'en').description).toMatch(/^Formula 1 drivers'/)
  })
})
