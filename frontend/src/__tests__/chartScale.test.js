import { describe, expect, it } from 'vitest'
import { MAX_TICKS, minutesScale } from '../utils/chartScale.js'

describe('minutesScale', () => {
  it('has only zero with nothing to show', () => {
    expect(minutesScale(0)).toEqual({ top: 0, ticks: [0] })
  })

  it('steps by 15 or 30 minutes for small totals', () => {
    expect(minutesScale(40)).toEqual({ top: 45, ticks: [0, 15, 30, 45] })
    expect(minutesScale(100)).toEqual({ top: 120, ticks: [0, 30, 60, 90, 120] })
  })

  it('steps by whole hours, landing on round ones', () => {
    expect(minutesScale(130)).toEqual({ top: 180, ticks: [0, 60, 120, 180] })
    // 21 hours: 5-hour steps would take five, so it steps by 10.
    expect(minutesScale(1260)).toEqual({ top: 1800, ticks: [0, 600, 1200, 1800] })
  })

  it('never has more than a few steps, and always reaches the largest value', () => {
    for (const max of [1, 14, 59, 61, 199, 721, 5000, 99999]) {
      const { top, ticks } = minutesScale(max)
      expect(top).toBeGreaterThanOrEqual(max)
      expect(ticks.length - 1).toBeLessThanOrEqual(MAX_TICKS)
      expect(ticks.at(-1)).toBe(top)
    }
  })
})
