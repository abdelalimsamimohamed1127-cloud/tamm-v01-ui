import { describe, expect, it } from 'vitest'
import { getTierPriceEgp } from '@/lib/billing'

describe('billing pricing', () => {
  it('returns 0 for free', () => {
    expect(getTierPriceEgp('free')).toBe(0)
  })

  it('returns correct paid tier pricing', () => {
    expect(getTierPriceEgp('paid1')).toBeGreaterThan(0)
    expect(getTierPriceEgp('paid2')).toBeGreaterThan(getTierPriceEgp('paid1'))
    expect(getTierPriceEgp('paid3')).toBeGreaterThan(getTierPriceEgp('paid2'))
  })
})
