import { describe, expect, it } from 'vitest'
import { isSeason, seasonPath } from '../hooks/useSeasonRoute'
import { langFromPath, localizedPath, plural } from '../i18n/core'
import { driverPortraitUrl, f1SrcSet } from './f1meta'
import { CURRENT_SEASON } from './seasons'

describe('language from the address', () => {
  it('reads /uk and /uk/… as Ukrainian, everything else as English', () => {
    expect(langFromPath('/uk')).toBe('uk')
    expect(langFromPath('/uk/drivers')).toBe('uk')
    expect(langFromPath('/ukraine')).toBe('en')
    expect(langFromPath('/standings')).toBe('en')
  })

  it('moves a path between the languages', () => {
    expect(localizedPath('/standings', 'uk')).toBe('/uk/standings')
    expect(localizedPath('/', 'uk')).toBe('/uk')
    expect(localizedPath('/uk/standings', 'en')).toBe('/standings')
    expect(localizedPath('/uk', 'en')).toBe('/')
  })

  it('picks Ukrainian plural forms', () => {
    expect(plural('plural.wins', 1, undefined, 'uk')).toMatch(/^1 /)
    expect(plural('plural.wins', 3, undefined, 'uk')).not.toBe(plural('plural.wins', 5, undefined, 'uk').replace('5', '3'))
  })
})

describe('season addresses', () => {
  it('has a current season without a server (the calendar year)', () => {
    expect(CURRENT_SEASON).toBe(new Date().getFullYear())
  })

  it('gives the current season the bare section', () => {
    expect(seasonPath('/standings', CURRENT_SEASON)).toBe('/standings')
    expect(seasonPath('/standings', '1998')).toBe('/standings/1998')
  })

  it('knows a season from 1950 to now', () => {
    expect(isSeason('1950')).toBe(true)
    expect(isSeason('1949')).toBe(false)
    expect(isSeason(String(CURRENT_SEASON + 1))).toBe(false)
    expect(isSeason('20x5')).toBe(false)
  })
})

describe('formula1.com images', () => {
  it('builds a portrait from 2024 on, none before', () => {
    expect(driverPortraitUrl('max-verstappen', 'red-bull', '2025')).toContain('/2025/redbullracing/maxver01/')
    expect(driverPortraitUrl('max-verstappen', 'red-bull', '2023')).toBeNull()
  })

  it('offers the CDN widths for srcset, and nothing for other hosts', () => {
    const url = driverPortraitUrl('max-verstappen', 'red-bull', '2025')!
    const set = f1SrcSet(url)!
    expect(set.split(', ')).toHaveLength(7)
    expect(set).toContain('c_lfill,w_80/')
    expect(set).toContain(' 80w')
    expect(set).toContain('c_lfill,w_800/')
    expect(f1SrcSet('https://upload.wikimedia.org/a.jpg')).toBeUndefined()
    expect(f1SrcSet(null)).toBeUndefined()
  })
})
