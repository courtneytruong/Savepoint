import { useState } from 'react'

// Storage can be blocked or full. These are only preferences, so losing one is
// better than breaking the page.
function readStored(key, choices, fallback) {
  try {
    const stored = window.localStorage.getItem(key)
    return choices.find((choice) => String(choice) === stored) ?? fallback
  } catch {
    return fallback
  }
}

function store(key, choice) {
  try {
    window.localStorage.setItem(key, String(choice))
  } catch {
    // The choice still applies until the page is reloaded.
  }
}

/**
 * One of a fixed set of choices, remembered between visits in this browser. A
 * stored value that isn't one of the choices is ignored.
 */
export function useStoredChoice(key, choices, fallback) {
  const [choice, setChoice] = useState(() => readStored(key, choices, fallback))

  function changeChoice(nextChoice) {
    setChoice(nextChoice)
    store(key, nextChoice)
  }

  return [choice, changeChoice]
}

/** The library's list or grid view, remembered between visits in this browser. */
export function useStoredView(fallback = 'list') {
  return useStoredChoice('savepoint.library.view', ['list', 'grid'], fallback)
}
