import { BoredIcon, CuriousIcon, DelightedIcon, FrustratedIcon, HookedIcon, MovedIcon } from './icons.js'

// The moods in docs/data-model.md, each with its own color and icon.
export const MOODS = [
  { value: 'Hooked', color: 'var(--color-mood-hooked)', Icon: HookedIcon },
  { value: 'Delighted', color: 'var(--color-mood-delighted)', Icon: DelightedIcon },
  { value: 'Moved', color: 'var(--color-mood-moved)', Icon: MovedIcon },
  { value: 'Curious', color: 'var(--color-mood-curious)', Icon: CuriousIcon },
  { value: 'Frustrated', color: 'var(--color-mood-frustrated)', Icon: FrustratedIcon },
  { value: 'Bored', color: 'var(--color-mood-bored)', Icon: BoredIcon },
]

export const moodFor = (value) => MOODS.find((mood) => mood.value === value)
