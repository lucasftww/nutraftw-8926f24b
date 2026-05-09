import { describe, it, expect } from 'vitest'
import { validateCheckoutForm } from '@/lib/checkoutValidation'
import type { CheckoutValidationInput } from '@/lib/checkoutValidation'

const VALID_FORM: CheckoutValidationInput = {
  full_name: 'João da Silva',
  email: 'joao@exemplo.com',
  cpf: '529.982.247-25',
  phone: '(11) 98765-4321',
  zip: '01310-100',
  street: 'Rua das Flores',
  number: '123',
  district: 'Centro',
  city: 'São Paulo',
  state: 'SP',
  payment_method: 'pix',
}

const VALID_OPTS = {
  shippingId: 'ship-1',
  shippingOptionsCount: 1,
  pixEnabled: true,
  cardEnabled: true,
}

describe('validateCheckoutForm', () => {
  it('returns null for a valid form', () => {
    expect(validateCheckoutForm(VALID_FORM, VALID_OPTS)).toBeNull()
  })

  it('fails when name has only one word', () => {
    const form = { ...VALID_FORM, full_name: 'João' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/nome/i)
  })

  it('fails when email is invalid', () => {
    const form = { ...VALID_FORM, email: 'invalido' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/e-mail/i)
  })

  it('fails when CPF is invalid', () => {
    const form = { ...VALID_FORM, cpf: '111.111.111-11' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/cpf/i)
  })

  it('fails when phone is too short', () => {
    const form = { ...VALID_FORM, phone: '1199' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/telefone/i)
  })

  it('fails when zip is invalid', () => {
    const form = { ...VALID_FORM, zip: '0131' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/cep/i)
  })

  it('fails when street is missing', () => {
    const form = { ...VALID_FORM, street: '' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/rua/i)
  })

  it('fails when number is missing', () => {
    const form = { ...VALID_FORM, number: '' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/número/i)
  })

  it('fails when district is missing', () => {
    const form = { ...VALID_FORM, district: '' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/bairro/i)
  })

  it('fails when city is missing', () => {
    const form = { ...VALID_FORM, city: '' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/cidade/i)
  })

  it('fails when state is not 2 chars', () => {
    const form = { ...VALID_FORM, state: 'S' }
    expect(validateCheckoutForm(form, VALID_OPTS)).toMatch(/estado/i)
  })

  it('fails when no shipping selected and options exist', () => {
    const opts = { ...VALID_OPTS, shippingId: null, shippingOptionsCount: 2 }
    expect(validateCheckoutForm(VALID_FORM, opts)).toMatch(/frete/i)
  })

  it('reports no shipping available when options count is 0', () => {
    const opts = { ...VALID_OPTS, shippingId: null, shippingOptionsCount: 0 }
    const result = validateCheckoutForm(VALID_FORM, opts)
    expect(result).toMatch(/não há frete/i)
  })

  it('fails when no payment method enabled', () => {
    const opts = { ...VALID_OPTS, pixEnabled: false, cardEnabled: false }
    expect(validateCheckoutForm(VALID_FORM, opts)).toMatch(/indisponíveis/i)
  })

  it('fails when pix selected but pix disabled', () => {
    const form = { ...VALID_FORM, payment_method: 'pix' as const }
    const opts = { ...VALID_OPTS, pixEnabled: false, cardEnabled: true }
    expect(validateCheckoutForm(form, opts)).toMatch(/pix/i)
  })

  it('fails when credit_card selected but card disabled', () => {
    const form = { ...VALID_FORM, payment_method: 'credit_card' as const }
    const opts = { ...VALID_OPTS, pixEnabled: true, cardEnabled: false }
    expect(validateCheckoutForm(form, opts)).toMatch(/cartão/i)
  })
})
