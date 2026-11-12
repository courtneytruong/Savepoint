import { describe, expect, it } from 'vitest'
import { formatClock, formatDuration } from '../utils/duration.js'

describe('formatClock', () => {
  it('shows minutes and two-digit seconds', () => {
    expect(formatClock(287)).toBe('4:47')
    expect(formatClock(300)).toBe('5:00')
    expect(formatClock(9)).toBe('0:09')
    expect(formatClock(0)).toBe('0:00')
  })
})

describe('formatDuration', () => {
  it('says minutes and seconds in words, leaving out a zero part', () => {
    expect(formatDuration(287)).toBe('4 minutes 47 seconds')
    expect(formatDuration(300)).toBe('5 minutes')
    expect(formatDuration(45)).toBe('45 seconds')
  })

  it('uses the singular for one', () => {
    expect(formatDuration(61)).toBe('1 minute 1 second')
    expect(formatDuration(1)).toBe('1 second')
  })
})
