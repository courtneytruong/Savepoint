import { useState } from 'react'

/**
 * A new number each time open turns true. As a key, it gives a modal's form
 * fresh state for each opening: what was typed, its errors, and whether it's
 * saving, which the button in the footer shows too.
 */
export function useOpening(open) {
  const [wasOpen, setWasOpen] = useState(open)
  const [opening, setOpening] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpening((count) => count + 1)
  }
  return opening
}
