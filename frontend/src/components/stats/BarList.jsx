import styles from './BarList.module.css'
import { classNames } from '../../utils/classNames.js'
import { VisuallyHidden } from '../ui/VisuallyHidden.jsx'

const count = new Intl.NumberFormat()

/**
 * Named amounts as a list of horizontal bars, longest for the largest. Each row
 * shows its name and its amount in text, so the bars are only for comparing at a
 * glance, and nothing needs a tooltip or a table to be read.
 *
 * label: what the list shows, for screen readers.
 * rows: [{ key, name, value, color, icon }]. The bar takes color, as a mood's;
 * icon, if any, sits before the name in the same color. Rows show in the order
 * given.
 */
export function BarList({ label, rows, className }) {
  const largest = Math.max(0, ...rows.map((row) => row.value))

  return (
    <ol aria-label={label} className={classNames(styles.list, className)}>
      {rows.map(({ key, name, value, color, icon }) => (
        <li key={key} className={styles.row} style={{ '--bar-color': color }}>
          <span className={styles.name}>
            {icon && (
              <span className={styles.icon} aria-hidden="true">
                {icon}
              </span>
            )}
            {name}
          </span>
          {/* Read out as "Hooked, 12", not "Hooked12". */}
          <VisuallyHidden>, </VisuallyHidden>
          <span className={styles.track} aria-hidden="true">
            {value > 0 && <span className={styles.bar} style={{ width: `${(value / largest) * 100}%` }} />}
          </span>
          <span className={styles.value}>{count.format(value)}</span>
        </li>
      ))}
    </ol>
  )
}
