import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setAffiliateRef,
  getAffiliateRef,
  getAffiliateRefData,
  clearAffiliateRef,
  readAttributionFromUrl,
} from '@/lib/affiliateRef'

beforeEach(() => {
  localStorage.clear()
  clearAffiliateRef()
})

describe('setAffiliateRef', () => {
  it('stores a valid code and returns it', () => {
    const result = setAffiliateRef('AFIL01')
    expect(result).toBe('AFIL01')
    expect(getAffiliateRef()).toBe('AFIL01')
  })

  it('uppercases the code', () => {
    setAffiliateRef('afil01')
    expect(getAffiliateRef()).toBe('AFIL01')
  })

  it('returns null for empty/null input', () => {
    expect(setAffiliateRef(null)).toBeNull()
    expect(setAffiliateRef('')).toBeNull()
  })

  it('returns null for codes shorter than 4 chars', () => {
    expect(setAffiliateRef('ABC')).toBeNull()
  })

  it('returns null for codes longer than 16 chars', () => {
    expect(setAffiliateRef('A'.repeat(17))).toBeNull()
  })

  it('returns null for code with special chars', () => {
    expect(setAffiliateRef('AFIL@01')).toBeNull()
  })

  it('first-touch: does not overwrite existing valid code', () => {
    setAffiliateRef('FIRST1')
    const result = setAffiliateRef('SECOND2')
    // Returns the first code
    expect(result).toBe('FIRST1')
    expect(getAffiliateRef()).toBe('FIRST1')
  })

  it('stores attribution data along with code', () => {
    setAffiliateRef('AFIL01', { utm_source: 'google', utm_medium: 'cpc' })
    const data = getAffiliateRefData()
    expect(data?.utm_source).toBe('google')
    expect(data?.utm_medium).toBe('cpc')
  })
})

describe('getAffiliateRef', () => {
  it('returns null when nothing stored', () => {
    expect(getAffiliateRef()).toBeNull()
  })

  it('returns null after clearAffiliateRef', () => {
    setAffiliateRef('AFIL01')
    clearAffiliateRef()
    expect(getAffiliateRef()).toBeNull()
  })
})

describe('getAffiliateRefData TTL expiry', () => {
  it('returns null and clears storage when TTL expired', () => {
    setAffiliateRef('AFIL01')

    // Fast-forward time past 30 days
    const TTL_MS = 30 * 24 * 60 * 60 * 1000
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + TTL_MS + 1000)

    const data = getAffiliateRefData()
    expect(data).toBeNull()
    expect(localStorage.getItem('nutra.affiliate.ref.v1')).toBeNull()

    vi.restoreAllMocks()
  })

  it('returns data when within TTL', () => {
    setAffiliateRef('AFIL01')
    // Advance by less than 30 days
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1000 * 60 * 60)

    const data = getAffiliateRefData()
    expect(data?.code).toBe('AFIL01')

    vi.restoreAllMocks()
  })
})

describe('readAttributionFromUrl', () => {
  it('extracts UTM params from search string', () => {
    const attr = readAttributionFromUrl('?utm_source=google&utm_medium=cpc&utm_campaign=summer')
    expect(attr.utm_source).toBe('google')
    expect(attr.utm_medium).toBe('cpc')
    expect(attr.utm_campaign).toBe('summer')
  })

  it('returns empty object when no UTMs', () => {
    const attr = readAttributionFromUrl('?foo=bar')
    expect(attr.utm_source).toBeUndefined()
    expect(attr.utm_medium).toBeUndefined()
  })

  it('truncates utm values longer than 200 chars', () => {
    const long = 'x'.repeat(300)
    const attr = readAttributionFromUrl(`?utm_source=${long}`)
    expect(attr.utm_source?.length).toBe(200)
  })
})
