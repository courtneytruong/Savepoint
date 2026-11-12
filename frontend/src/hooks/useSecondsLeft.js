import { useEffect, useState } from 'react'

const secondsUntil = (endsAt) => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))

/**
 * Whole seconds until endsAt (a time from Date.now()), rounded up so 0 means
 * it's over, and re-rendering as each second passes. null when endsAt is null.
 *
 * It reads the clock each time rather than counting ticks, so a slow or paused
 * tab still shows the right time when it wakes.
 */
export function useSecondsLeft(endsAt) {
  // Only there to re-render when a second passes; the clock gives the value.
  const [tick, setTick] = useState(0)
  const secondsLeft = endsAt == null ? null : secondsUntil(endsAt)

  useEffect(() => {
    if (endsAt == null || secondsUntil(endsAt) === 0) return undefined
    // Waits for the next whole second, so the number changes on time.
    const untilNextSecond = (endsAt - Date.now()) % 1000 || 1000
    const timer = setTimeout(() => setTick((count) => count + 1), untilNextSecond)
    return () => clearTimeout(timer)
  }, [endsAt, tick])

  return secondsLeft
}
