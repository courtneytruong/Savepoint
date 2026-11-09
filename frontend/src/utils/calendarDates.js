// Dates are handled as local calendar days, written as 'YYYY-MM-DD' like the
// Sessions.Date column. Parsing them by hand avoids `new Date('2026-11-05')`,
// which reads the text as midnight UTC and can land on the previous day.

const pad = (number) => String(number).padStart(2, '0')

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseDateKey(key) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1)
}

/**
 * The month as weeks of seven, with null for the days before the 1st and after
 * the last. weekStartsOn is 0 for Sunday through 6 for Saturday.
 */
export function monthWeeks(month, weekStartsOn = 0) {
  const year = month.getFullYear()
  const index = month.getMonth()
  const leading = (new Date(year, index, 1).getDay() - weekStartsOn + 7) % 7
  const days = new Date(year, index + 1, 0).getDate()

  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: days }, (_, day) => new Date(year, index, day + 1)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7))
}

/** Short weekday names in the person's language, starting on weekStartsOn. */
export function weekdayNames(weekStartsOn = 0, locale) {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  // 1 January 2023 was a Sunday.
  return Array.from({ length: 7 }, (_, index) => format.format(new Date(2023, 0, 1 + ((weekStartsOn + index) % 7))))
}

/** The first day of the week where the person lives, such as Monday in most of Europe. */
export function localeWeekStart() {
  try {
    const locale = new Intl.Locale(navigator.language)
    const info = locale.getWeekInfo?.() ?? locale.weekInfo
    // The browser counts Monday as 1 and Sunday as 7.
    return info ? info.firstDay % 7 : 0
  } catch {
    return 0
  }
}

/** Minutes as "45m", "2h" or "1h 30m". */
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}
