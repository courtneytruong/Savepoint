// Axis steps for charts of time, in minutes, so ticks land on round amounts:
// 15m and 30m for small totals, then 1, 2, 3 and 5 hours, times 10, 100 and so on.
const STEPS = [
  15,
  30,
  ...[1, 10, 100, 1000].flatMap((magnitude) => [1, 2, 3, 5].map((step) => step * magnitude * 60)),
]

/** At most this many steps above zero, so the labels never crowd. */
export const MAX_TICKS = 4

/**
 * The axis for values up to max minutes: the smallest round step that reaches
 * max in MAX_TICKS steps or fewer. top is the axis's highest value, ticks every
 * value from 0 up to top. With nothing to show, top is 0 and ticks is [0].
 */
export function minutesScale(max) {
  if (max <= 0) return { top: 0, ticks: [0] }
  const step = STEPS.find((candidate) => Math.ceil(max / candidate) <= MAX_TICKS) ?? STEPS.at(-1)
  const top = Math.ceil(max / step) * step
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, index) => index * step) }
}
