// Ways to show a number of seconds.

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/** As a countdown clock: 287 is "4:47", 9 is "0:09". */
export function formatClock(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

/** In words, for screen readers: 287 is "4 minutes 47 seconds", 60 is "1 minute". */
export function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes === 0) return plural(rest, 'second')
  if (rest === 0) return plural(minutes, 'minute')
  return `${plural(minutes, 'minute')} ${plural(rest, 'second')}`
}
