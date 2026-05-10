import { describe, it, expect } from 'vitest'
import { getProductPricing, productScore, isTirzepatidaCategory, discountPctOf } from '@/lib/catalog'

describe('getProductPricing', () => {
  it('returns correct values when no sale price', () => {
    const result = getProductPricing({ price: 100, sale_price: null })
    expect(result.basePrice).toBe(100)
    expect(result.salePrice).toBeNull()
    expect(result.finalPrice).toBe(100)
    expect(result.hasSale).toBe(false)
    expect(result.discountPct).toBe(0)
    expect(result.savings).toBe(0)
    expect(result.pixPrice).toBe(95) // 5% off
  })

  it('returns sale info when sale_price is lower than price', () => {
    const result = getProductPricing({ price: 200, sale_price: 150 })
    expect(result.hasSale).toBe(true)
    expect(result.salePrice).toBe(150)
    expect(result.finalPrice).toBe(150)
    expect(result.discountPct).toBe(25)
    expect(result.savings).toBe(50)
    expect(result.pixPrice).toBe(150 * 0.95)
  })

  it('ignores sale_price when discount < 1%', () => {
    const result = getProductPricing({ price: 100, sale_price: 99.5 })
    expect(result.hasSale).toBe(false)
    expect(result.discountPct).toBe(0)
  })

  it('ignores sale_price when it equals base price', () => {
    const result = getProductPricing({ price: 100, sale_price: 100 })
    expect(result.hasSale).toBe(false)
  })

  it('ignores sale_price when it is higher than base price', () => {
    const result = getProductPricing({ price: 100, sale_price: 120 })
    expect(result.hasSale).toBe(false)
  })

  it('handles price as string', () => {
    const result = getProductPricing({ price: '150' as any, sale_price: '120' as any })
    expect(result.basePrice).toBe(150)
    expect(result.salePrice).toBe(120)
    expect(result.hasSale).toBe(true)
  })

  it('rounds discountPct to nearest integer', () => {
    // 100 -> 67 = 33% discount
    const result = getProductPricing({ price: 100, sale_price: 67 })
    expect(result.discountPct).toBe(33)
  })
})

describe('discountPctOf (deprecated)', () => {
  it('returns 0 when no sale', () => {
    const p = { price: 100, sale_price: null, stock: 5, is_featured: false, created_at: new Date().toISOString() } as any
    expect(discountPctOf(p)).toBe(0)
  })

  it('returns fractional discount', () => {
    const p = { price: 100, sale_price: 80, stock: 5, is_featured: false, created_at: new Date().toISOString() } as any
    expect(discountPctOf(p)).toBe(0.20)
  })
})

describe('productScore', () => {
  const base = { stock: 0, is_featured: false, created_at: new Date('2024-01-01').toISOString(), price: 100, sale_price: null } as any

  it('gives higher score to in-stock products', () => {
    const inStock = { ...base, stock: 5 }
    const outOfStock = { ...base, stock: 0 }
    expect(productScore(inStock)).toBeGreaterThan(productScore(outOfStock))
  })

  it('gives higher score to featured products', () => {
    const featured = { ...base, stock: 5, is_featured: true }
    const normal = { ...base, stock: 5, is_featured: false }
    expect(productScore(featured)).toBeGreaterThan(productScore(normal))
  })

  it('gives higher score to more recent products', () => {
    const newer = { ...base, stock: 5, created_at: new Date('2025-01-01').toISOString() }
    const older = { ...base, stock: 5, created_at: new Date('2020-01-01').toISOString() }
    expect(productScore(newer)).toBeGreaterThan(productScore(older))
  })
})

describe('isTirzepatidaCategory', () => {
  it('returns true for category with tirzepatida in name', () => {
    expect(isTirzepatidaCategory({ name: 'Tirzepatida', slug: 'tirzepatida' })).toBe(true)
  })

  it('returns true for category with tirze abbreviation', () => {
    expect(isTirzepatidaCategory({ name: 'Tirze Plus', slug: 'tirze-plus' })).toBe(true)
  })

  it('returns true ignoring accents', () => {
    expect(isTirzepatidaCategory({ name: 'Tirzepátida', slug: 'tirzepatida' })).toBe(true)
  })

  it('returns false for unrelated category', () => {
    expect(isTirzepatidaCategory({ name: 'Vitaminas', slug: 'vitaminas' })).toBe(false)
  })

  it('handles null values gracefully', () => {
    expect(isTirzepatidaCategory({ name: null, slug: null })).toBe(false)
  })
})
