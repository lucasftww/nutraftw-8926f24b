import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePhoneBR,
  validateCEP,
  validateCPF,
  isValidCPF,
  validateFullName,
} from '@/lib/validators'

describe('validateEmail', () => {
  it('returns ok for valid email', () => {
    expect(validateEmail('joao@exemplo.com').ok).toBe(true)
  })

  it('fails when empty', () => {
    const r = validateEmail('')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/e-mail/i)
  })

  it('fails when email has no @', () => {
    expect(validateEmail('joaoexemplo.com').ok).toBe(false)
  })

  it('fails when email is too long', () => {
    const long = 'a'.repeat(250) + '@x.com'
    expect(validateEmail(long).ok).toBe(false)
  })

  it('fails when domain extension is missing', () => {
    expect(validateEmail('joao@exemplo').ok).toBe(false)
  })

  it('trims whitespace before checking', () => {
    expect(validateEmail('  joao@exemplo.com  ').ok).toBe(true)
  })
})

describe('validatePhoneBR', () => {
  it('accepts 11-digit mobile starting with 9', () => {
    expect(validatePhoneBR('(11) 98765-4321').ok).toBe(true)
  })

  it('accepts 10-digit landline', () => {
    expect(validatePhoneBR('(11) 3456-7890').ok).toBe(true)
  })

  it('fails when empty', () => {
    expect(validatePhoneBR('').ok).toBe(false)
  })

  it('fails when too short', () => {
    expect(validatePhoneBR('1198765').ok).toBe(false)
  })

  it('fails when 11 digits but cell does not start with 9', () => {
    expect(validatePhoneBR('11 88765-4321').ok).toBe(false)
  })

  it('fails with invalid DDD below 11', () => {
    expect(validatePhoneBR('01 98765-4321').ok).toBe(false)
  })

  it('fails when too long', () => {
    expect(validatePhoneBR('119876543210').ok).toBe(false)
  })
})

describe('validateCEP', () => {
  it('accepts valid 8-digit CEP', () => {
    expect(validateCEP('01310-100').ok).toBe(true)
  })

  it('accepts raw 8 digits', () => {
    expect(validateCEP('01310100').ok).toBe(true)
  })

  it('fails when empty', () => {
    expect(validateCEP('').ok).toBe(false)
  })

  it('fails when too short', () => {
    expect(validateCEP('0131010').ok).toBe(false)
  })

  it('fails when all zeros', () => {
    expect(validateCEP('00000000').ok).toBe(false)
  })

  it('fails when too long', () => {
    expect(validateCEP('013101001').ok).toBe(false)
  })
})

describe('isValidCPF', () => {
  it('returns true for a valid CPF', () => {
    // CPF válido gerado matematicamente
    expect(isValidCPF('529.982.247-25')).toBe(true)
  })

  it('returns false for all-same-digit CPF', () => {
    expect(isValidCPF('111.111.111-11')).toBe(false)
    expect(isValidCPF('000.000.000-00')).toBe(false)
  })

  it('returns false for wrong length', () => {
    expect(isValidCPF('123')).toBe(false)
  })

  it('returns false for wrong check digits', () => {
    expect(isValidCPF('529.982.247-26')).toBe(false)
  })
})

describe('validateCPF', () => {
  it('returns ok for valid CPF', () => {
    expect(validateCPF('529.982.247-25').ok).toBe(true)
  })

  it('fails when empty', () => {
    const r = validateCPF('')
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/cpf/i)
  })

  it('fails when too short', () => {
    expect(validateCPF('529.982').ok).toBe(false)
  })

  it('fails when invalid check digits', () => {
    expect(validateCPF('529.982.247-26').ok).toBe(false)
  })
})

describe('validateFullName', () => {
  it('accepts a full name with first and last name', () => {
    expect(validateFullName('João da Silva').ok).toBe(true)
  })

  it('fails when empty', () => {
    expect(validateFullName('').ok).toBe(false)
  })

  it('fails when only one word', () => {
    expect(validateFullName('João').ok).toBe(false)
  })

  it('fails when name is too short', () => {
    expect(validateFullName('Jo').ok).toBe(false)
  })

  it('fails when name is too long', () => {
    expect(validateFullName('a '.repeat(51).trim()).ok).toBe(false)
  })

  it('fails when contains numbers', () => {
    expect(validateFullName('João 123').ok).toBe(false)
  })

  it('accepts accented characters', () => {
    expect(validateFullName('André Gonçalves').ok).toBe(true)
  })
})
