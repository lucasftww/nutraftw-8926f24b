import { describe, it, expect } from 'vitest'
import { cn, formatBRL, slugify, onlyDigits, maskCPF, maskPhone, maskCEP } from '@/lib/utils'

describe('onlyDigits', () => {
  it('strips non-digit characters', () => {
    expect(onlyDigits('(11) 98765-4321')).toBe('11987654321')
  })

  it('returns empty string for empty input', () => {
    expect(onlyDigits('')).toBe('')
  })

  it('handles null/undefined gracefully', () => {
    expect(onlyDigits(undefined as any)).toBe('')
  })

  it('returns only digits from mixed string', () => {
    expect(onlyDigits('abc123def456')).toBe('123456')
  })
})

describe('maskCPF', () => {
  it('formats 11 digits as CPF', () => {
    expect(maskCPF('52998224725')).toBe('529.982.247-25')
  })

  it('formats partial input', () => {
    expect(maskCPF('529982')).toBe('529.982')
  })

  it('handles already-formatted input', () => {
    expect(maskCPF('529.982.247-25')).toBe('529.982.247-25')
  })

  it('truncates to 11 digits', () => {
    expect(maskCPF('529982247251234')).toBe('529.982.247-25')
  })

  it('returns empty for empty input', () => {
    expect(maskCPF('')).toBe('')
  })
})

describe('maskPhone', () => {
  it('formats 11-digit cell phone', () => {
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321')
  })

  it('formats 10-digit landline', () => {
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890')
  })

  it('handles already-masked input', () => {
    expect(maskPhone('(11) 98765-4321')).toBe('(11) 98765-4321')
  })

  it('truncates to 11 digits', () => {
    expect(maskPhone('119876543219999')).toBe('(11) 98765-4321')
  })

  it('returns empty for empty input', () => {
    expect(maskPhone('')).toBe('')
  })
})

describe('maskCEP', () => {
  it('formats 8 digits as CEP', () => {
    expect(maskCEP('01310100')).toBe('01310-100')
  })

  it('handles already-formatted CEP', () => {
    expect(maskCEP('01310-100')).toBe('01310-100')
  })

  it('handles partial CEP', () => {
    expect(maskCEP('01310')).toBe('01310')
  })

  it('truncates to 8 digits', () => {
    expect(maskCEP('013101001234')).toBe('01310-100')
  })

  it('returns empty for empty input', () => {
    expect(maskCEP('')).toBe('')
  })
})

describe('slugify', () => {
  it('converts to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('removes accents', () => {
    expect(slugify('ação')).toBe('acao')
  })

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar baz')).toBe('foo-bar-baz')
  })

  it('removes leading and trailing hyphens', () => {
    expect(slugify(' hello ')).toBe('hello')
  })

  it('collapses multiple non-alphanumeric chars', () => {
    expect(slugify('foo--bar!!baz')).toBe('foo-bar-baz')
  })
})

describe('formatBRL', () => {
  it('formats number as Brazilian Real', () => {
    const result = formatBRL(1234.56)
    expect(result).toContain('1.234,56')
    expect(result).toContain('R$')
  })

  it('formats zero', () => {
    const result = formatBRL(0)
    expect(result).toContain('0,00')
  })
})

describe('cn (class merger)', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    // eslint-disable-next-line no-constant-binary-expression
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('resolves tailwind conflicts (last wins)', () => {
    // tailwind-merge: p-2 overrides p-4
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })
})
