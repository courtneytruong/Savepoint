import { useId, useState } from 'react'
import styles from './MonthlyTimeChart.module.css'
import { classNames } from '../../utils/classNames.js'
import { formatDuration, parseDateKey } from '../../utils/calendarDates.js'
import { minutesScale } from '../../utils/chartScale.js'
import { Button } from '../ui/Button.jsx'
import { Table } from '../ui/Table.jsx'

// Books sit at the bottom of each column, games on top, in the same order as the legend.
const SERIES = [
  { key: 'Book', label: 'Books', verb: 'reading', color: 'var(--color-series-book)' },
  { key: 'Game', label: 'Games', verb: 'playing', color: 'var(--color-series-game)' },
]

// Past a year of columns, only Januaries and the first month are labelled, so the
// labels have room.
const LABEL_EVERY_MONTH = 12

const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthAndYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })

const dateOf = (month) => parseDateKey(`${month}-01`)
const totalOf = (month) => month.Book + month.Game

// "March 2026: 2h 10m, 40m reading and 1h 30m playing", "April 2026: 15m reading"
// when there's only one kind, or "no time logged".
function describe(month) {
  const total = totalOf(month)
  const name = monthAndYear.format(dateOf(month.month))
  if (!total) return `${name}: no time logged`
  const parts = SERIES.filter(({ key }) => month[key]).map(({ key, verb }) => `${formatDuration(month[key])} ${verb}`)
  if (parts.length === 1) return `${name}: ${parts[0]}`
  return `${name}: ${formatDuration(total)}, ${parts.join(' and ')}`
}

const TABLE_COLUMNS = [
  { key: 'month', header: 'Month', render: (row) => monthAndYear.format(dateOf(row.month)) },
  ...SERIES.map(({ key, verb }) => ({
    key,
    header: verb[0].toUpperCase() + verb.slice(1),
    align: 'end',
    render: (row) => formatDuration(row[key]),
  })),
  { key: 'total', header: 'Total', align: 'end', render: (row) => formatDuration(totalOf(row)) },
]

/**
 * Time logged each month as columns, books and games stacked, from buildStats'
 * months: [{ month: 'YYYY-MM', Book, Game }] in minutes.
 *
 * Each column can be focused, and names its month and amounts for screen
 * readers; hovering or focusing one shows the same in a tooltip. The busiest
 * month is labelled with its total, and a button shows every value as a table,
 * so nothing is only in the tooltip.
 *
 * label: what the chart shows, naming its list of columns and the table.
 */
export function MonthlyTimeChart({ months, label, className }) {
  const [active, setActive] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()

  const totals = months.map(totalOf)
  const busiest = Math.max(0, ...totals)
  const { top, ticks } = minutesScale(busiest)
  const busiestIndex = totals.indexOf(busiest)
  const sparse = months.length > LABEL_EVERY_MONTH
  const percent = (minutes) => `${(minutes / top) * 100}%`

  // The tooltip lines up with its column, but keeps clear of the chart's edges.
  const along = active === null ? 0 : (active + 0.5) / months.length
  const shift = along < 0.2 ? '0%' : along > 0.8 ? '-100%' : '-50%'

  return (
    <div className={classNames(styles.chart, className)}>
      <div className={styles.header}>
        <ul className={styles.legend}>
          {SERIES.map(({ key, label: name, color }) => (
            <li key={key}>
              <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
        <Button
          variant="text"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((shown) => !shown)}
        >
          {showTable ? 'Hide table' : 'Show as table'}
        </Button>
      </div>

      <div className={styles.plot}>
        {/* The amounts are in each column's name, so the axis is only for the eye. */}
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: percent(tick) }}>
              {formatDuration(tick)}
            </span>
          ))}
        </div>

        <div className={styles.area}>
          <div className={styles.grid} aria-hidden="true">
            {ticks.map((tick) => (
              <span key={tick} className={tick === 0 ? styles.baseline : undefined} style={{ bottom: percent(tick) }} />
            ))}
          </div>

          <ol className={styles.columns} aria-label={label} style={{ '--count': months.length }}>
            {months.map((month, index) => {
              const date = dateOf(month.month)
              const labelled = !sparse || index === 0 || date.getMonth() === 0
              const withYear = index === 0 || date.getMonth() === 0
              return (
                <li key={month.month} className={classNames(styles.column, active === index && styles.active)}>
                  <div
                    role="img"
                    tabIndex={0}
                    aria-label={describe(month)}
                    className={styles.hit}
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  >
                    {index === busiestIndex && busiest > 0 && (
                      <span className={styles.cap} aria-hidden="true">
                        {formatDuration(busiest)}
                      </span>
                    )}
                    {totals[index] > 0 && (
                      <span className={styles.bar} style={{ height: percent(totals[index]) }}>
                        {SERIES.filter(({ key }) => month[key]).map(({ key, color }) => (
                          <span key={key} className={styles.segment} style={{ flexGrow: month[key], background: color }} />
                        ))}
                      </span>
                    )}
                  </div>
                  <span className={styles.month} aria-hidden="true">
                    {labelled && (
                      <>
                        {monthName.format(date)}
                        {withYear && <span className={styles.year}>{date.getFullYear()}</span>}
                      </>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>

          {active !== null && (
            // The same words as the column's name, which screen readers already hear.
            <div
              className={styles.tooltip}
              style={{ left: `${along * 100}%`, transform: `translateX(${shift})` }}
              aria-hidden="true"
            >
              <span className={styles.tooltipMonth}>{monthAndYear.format(dateOf(months[active].month))}</span>
              <strong className={styles.tooltipTotal}>{formatDuration(totals[active])}</strong>
              {SERIES.map(({ key, verb, color }) => (
                <span key={key} className={styles.tooltipRow}>
                  <span className={styles.lineKey} style={{ background: color }} />
                  <strong>{formatDuration(months[active][key])}</strong> {verb}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div id={tableId} hidden={!showTable}>
        {showTable && <Table caption={label} columns={TABLE_COLUMNS} rows={months} rowKey="month" />}
      </div>
    </div>
  )
}
