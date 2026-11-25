// Axis steps for charts, so ticks land on round amounts.

/** At most this many steps above zero, so the labels never crowd. */
export const MAX_TICKS = 4

const MAGNITUDES = [1, 10, 100, 1000, 10000]

// Time in minutes: 15m and 30m for small totals, then 1, 2, 3 and 5 hours, times
// 10, 100 and so on.
const MINUTE_STEPS = [15, 30, ...MAGNITUDES.flatMap((magnitude) => [1, 2, 3, 5].map((step) => step * magnitude * 60))]

// Counts, such as pages: 1, 2 and 5, times 10, 100 and so on.
const COUNT_STEPS = MAGNITUDES.flatMap((magnitude) => [1, 2, 5].map((step) => step * magnitude))

// The smallest round step that reaches max in MAX_TICKS steps or fewer. top is the
// axis's highest value, ticks every value from 0 up to top. With nothing to show,
// top is 0 and ticks is [0].
function scale(max, steps) {
  if (max <= 0) return { top: 0, ticks: [0] }
  const step = steps.find((candidate) => Math.ceil(max / candidate) <= MAX_TICKS) ?? steps.at(-1)
  const top = Math.ceil(max / step) * step
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) }
}

/** The axis for up to max minutes, as { top, ticks }. */
export const minutesScale = (max) => scale(max, MINUTE_STEPS)

/** The axis for a count up to max, such as pages, as { top, ticks }. */
export const countScale = (max) => scale(max, COUNT_STEPS)
