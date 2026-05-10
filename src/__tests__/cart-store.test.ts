import { describe, it, expect, beforeEach } from 'vitest'

// cart-store uses localStorage — jsdom provides it
import { cart, CART_MAX_QTY_PER_ITEM } from '@/lib/cart-store'
import type { CartLine } from '@/lib/cart-store'

const PRODUCT_A: Omit<CartLine, 'qty' | 'updated_at'> = {
  product_id: 'prod-a',
  slug: 'produto-a',
  name: 'Produto A',
  price: 100,
  image_url: null,
}

const PRODUCT_B: Omit<CartLine, 'qty' | 'updated_at'> = {
  product_id: 'prod-b',
  slug: 'produto-b',
  name: 'Produto B',
  price: 50,
  image_url: null,
}

beforeEach(() => {
  localStorage.clear()
  cart.clear()
})

describe('cart.add', () => {
  it('adds a new item', () => {
    cart.add(PRODUCT_A, 1)
    const lines = cart.getLines()
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('prod-a')
    expect(lines[0].qty).toBe(1)
  })

  it('increments qty when same product added again', () => {
    cart.add(PRODUCT_A, 2)
    cart.add(PRODUCT_A, 3)
    expect(cart.getLines()[0].qty).toBe(5)
  })

  it('clamps qty at CART_MAX_QTY_PER_ITEM', () => {
    cart.add(PRODUCT_A, CART_MAX_QTY_PER_ITEM + 50)
    expect(cart.getLines()[0].qty).toBe(CART_MAX_QTY_PER_ITEM)
  })

  it('defaults qty to 1 when not provided', () => {
    cart.add(PRODUCT_A)
    expect(cart.getLines()[0].qty).toBe(1)
  })
})

describe('cart.remove', () => {
  it('removes the specified product', () => {
    cart.add(PRODUCT_A)
    cart.add(PRODUCT_B)
    cart.remove('prod-a')
    const lines = cart.getLines()
    expect(lines).toHaveLength(1)
    expect(lines[0].product_id).toBe('prod-b')
  })

  it('does nothing when product not in cart', () => {
    cart.add(PRODUCT_A)
    cart.remove('nonexistent')
    expect(cart.getLines()).toHaveLength(1)
  })
})

describe('cart.setQty', () => {
  it('updates quantity', () => {
    cart.add(PRODUCT_A, 3)
    cart.setQty('prod-a', 7)
    expect(cart.getLines()[0].qty).toBe(7)
  })

  it('removes item when qty <= 0', () => {
    cart.add(PRODUCT_A)
    cart.setQty('prod-a', 0)
    expect(cart.getLines()).toHaveLength(0)
  })

  it('clamps qty at CART_MAX_QTY_PER_ITEM', () => {
    cart.add(PRODUCT_A)
    cart.setQty('prod-a', CART_MAX_QTY_PER_ITEM + 10)
    expect(cart.getLines()[0].qty).toBe(CART_MAX_QTY_PER_ITEM)
  })

  it('does nothing when product not in cart', () => {
    cart.setQty('nonexistent', 5)
    expect(cart.getLines()).toHaveLength(0)
  })
})

describe('cart.getTotal', () => {
  it('returns sum of price * qty for all items', () => {
    cart.add(PRODUCT_A, 2) // 200
    cart.add(PRODUCT_B, 3) // 150
    expect(cart.getTotal()).toBe(350)
  })

  it('returns 0 for empty cart', () => {
    expect(cart.getTotal()).toBe(0)
  })
})

describe('cart.getCount', () => {
  it('returns total quantity across all lines', () => {
    cart.add(PRODUCT_A, 2)
    cart.add(PRODUCT_B, 4)
    expect(cart.getCount()).toBe(6)
  })

  it('returns 0 for empty cart', () => {
    expect(cart.getCount()).toBe(0)
  })
})

describe('cart.clear', () => {
  it('empties all lines', () => {
    cart.add(PRODUCT_A)
    cart.add(PRODUCT_B)
    cart.clear()
    expect(cart.getLines()).toHaveLength(0)
  })

  it('resets coupon', () => {
    cart.setCoupon('PROMO10')
    cart.clear()
    expect(cart.getCoupon()).toBeNull()
  })
})

describe('cart.setCoupon / getCoupon', () => {
  it('stores and retrieves a coupon code', () => {
    cart.setCoupon('PROMO10')
    expect(cart.getCoupon()).toBe('PROMO10')
  })

  it('uppercases the coupon code', () => {
    cart.setCoupon('promo10')
    expect(cart.getCoupon()).toBe('PROMO10')
  })

  it('sets coupon to null when empty string is passed', () => {
    cart.setCoupon('PROMO10')
    cart.setCoupon('')
    expect(cart.getCoupon()).toBeNull()
  })

  it('sets coupon to null when null is passed', () => {
    cart.setCoupon('PROMO10')
    cart.setCoupon(null)
    expect(cart.getCoupon()).toBeNull()
  })
})

describe('cart.subscribe', () => {
  it('calls listener when cart changes', () => {
    let called = 0
    const unsub = cart.subscribe(() => { called++ })
    cart.add(PRODUCT_A)
    unsub()
    expect(called).toBeGreaterThan(0)
  })

  it('returns unsubscribe function that stops notifications', () => {
    let called = 0
    const unsub = cart.subscribe(() => { called++ })
    unsub()
    cart.add(PRODUCT_A)
    expect(called).toBe(0)
  })
})
