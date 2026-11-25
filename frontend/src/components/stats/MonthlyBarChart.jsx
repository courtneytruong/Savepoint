import { useId, useState } from 'react'
import styles from './MonthlyBarChart.module.css'
import { classNames } from '../../utils/classNames.js'
import { formatDuration, parseDateKey } from '../../utils/calendarDates.js'
import { countScale, minutesScale } from '../../utils/chartScale.js'
import { Button } from '../ui/Button.jsx'
import { Table } from '../ui/Table.jsx'

// Past a year of columns, only Januaries and the first month are labelled, so the
// labels have room.
const LABEL_EVERY_MONTH = 12

const monthName = new Intl.DateTimeFormat(undefined, { month: 'short' })
const monthAndYear = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const count = new Intl.NumberFormat()

const dateOf = (month) => parseDateKey(`${month}-01`)

/**
 * A value each month as columns, from buildStats' months: [{ month: 'YYYY-MM',
 * ...values }]. With more than one series, they stack in order from the
 * baseline up, with a legend; with one, the heading above already says what it
 * shows, so there's none.
 *
 * series: [{ key, label, header, color, phrase }]. key: the value's field in
 * each month. label: its name in the legend. header: its table column. phrase:
 * the value in words, as "40m reading" or "42 pages".
 * format: a value as a tick, the busiest month's label and a total, as "2h 10m".
 * scale: the axis for a largest value, as chartScale's minutesScale.
 * nothing: what a month with nothing says, as "no time logged".
 * label: what the chart shows, naming its list of columns and the table.
 *
 * Each column can be focused, and names its month and values for screen
 * readers; hovering or focusing one shows the same in a tooltip. The busiest
 * month is labelled with its total, and a button shows every value as a table,
 * so nothing is only in the tooltip.
 */
export function MonthlyBarChart({ months, series, format, scale, nothing, label, className }) {
  const [active, setActive] = useState(null)
  const [showTable, setShowTable] = useState(false)
  const tableId = useId()
  const stacked = series.length > 1

  const totalOf = (month) => series.reduce((sum, { key }) => sum + month[key], 0)
  const totals = months.map(totalOf)
  const busiest = Math.max(0, ...totals)
  const { top, ticks } = scale(busiest)
  const busiestIndex = totals.indexOf(busiest)
  const sparse = months.length > LABEL_EVERY_MONTH
  const percent = (value) => `${(value / top) * 100}%`

  // "March 2026: 2h 10m, 40m reading and 1h 30m playing", "March 2026: 42 pages"
  // with one part, or "March 2026: no time logged".
  function describe(month) {
    const name = monthAndYear.format(dateOf(month.month))
    const parts = series.filter(({ key }) => month[key]).map(({ key, phrase }) => phrase(month[key]))
    if (!parts.length) return `${name}: ${nothing}`
    if (parts.length === 1) return `${name}: ${parts[0]}`
    return `${name}: ${format(totalOf(month))}, ${parts.join(' and ')}`
  }

  const tableColumns = [
    { key: 'month', header: 'Month', render: (row) => monthAndYear.format(dateOf(row.month)) },
    ...series.map(({ key, header }) => ({ key, header, align: 'end', render: (row) => format(row[key]) })),
    ...(stacked ? [{ key: 'total', header: 'Total', align: 'end', render: (row) => format(totalOf(row)) }] : []),
  ]

  // The tooltip lines up with its column, but keeps clear of the chart's edges.
  const along = active === null ? 0 : (active + 0.5) / months.length
  const shift = along < 0.2 ? '0%' : along > 0.8 ? '-100%' : '-50%'

  return (
    <div className={classNames(styles.chart, className)}>
      <div className={styles.header}>
        {stacked && (
          <ul className={styles.legend}>
            {series.map(({ key, label: name, color }) => (
              <li key={key}>
                <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
                {name}
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="text"
          aria-expanded={showTable}
          aria-controls={tableId}
          className={styles.tableToggle}
          onClick={() => setShowTable((shown) => !shown)}
        >
          {showTable ? 'Hide table' : 'Show as table'}
        </Button>
      </div>

      <div className={styles.plot}>
        {/* The values are in each column's name, so the axis is only for the eye. */}
        <div className={styles.axis} aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} style={{ bottom: percent(tick) }}>
              {format(tick)}
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
                        {format(busiest)}
                      </span>
                    )}
                    {totals[index] > 0 && (
                      // Rounded at the top and square on the baseline; the gaps
                      // between parts are the surface showing through.
                      <span className={styles.bar} style={{ height: percent(totals[index]) }}>
                        {series
                          .filter(({ key }) => month[key])
                          .map(({ key, color }) => (
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
              {stacked ? (
                <>
                  <strong className={styles.tooltipTotal}>{format(totals[active])}</strong>
                  {series.map(({ key, color, phrase }) => (
                    <span key={key} className={styles.tooltipRow}>
                      <span className={styles.lineKey} style={{ background: color }} />
                      {phrase(months[active][key])}
                    </span>
                  ))}
                </>
              ) : (
                <strong className={styles.tooltipTotal}>
                  {totals[active] ? series[0].phrase(totals[active]) : nothing}
                </strong>
              )}
            </div>
          )}
        </div>
      </div>

      <div id={tableId} hidden={!showTable}>
        {showTable && <Table caption={label} columns={tableColumns} rows={months} rowKey="month" />}
      </div>
    </div>
  )
}

// Reading at the bottom, playing on top, as in the legend.
const TIME_SERIES = [
  {
    key: 'Book',
    label: 'Books',
    header: 'Reading',
    color: 'var(--color-series-book)',
    phrase: (minutes) => `${formatDuration(minutes)} reading`,
  },
  {
    key: 'Game',
    label: 'Games',
    header: 'Playing',
    color: 'var(--color-series-game)',
    phrase: (minutes) => `${formatDuration(minutes)} playing`,
  },
]

/** Time logged each month, books and games stacked. months as buildStats gives them. */
export function MonthlyTimeChart(props) {
  return (
    <MonthlyBarChart series={TIME_SERIES} format={formatDuration} scale={minutesScale} nothing="no time logged" {...props} />
  )
}

// Only books have pages, so they're the book color.
const PAGE_SERIES = [
  {
    key: 'pages',
    label: 'Pages',
    header: 'Pages',
    color: 'var(--color-series-book)',
    phrase: (pages) => `${count.format(pages)} ${pages === 1 ? 'page' : 'pages'}`,
  },
]

/** Pages read each month, from book sessions. months as buildStats gives them. */
export function MonthlyPagesChart(props) {
  return (
    <MonthlyBarChart
      series={PAGE_SERIES}
      format={(pages) => count.format(pages)}
      scale={countScale}
      nothing="no pages read"
      {...props}
    />
  )
}
