import styles from './StatTile.module.css'
import { classNames } from './classNames.js'

/** A row of stat tiles. It's a description list, so each label stays tied to its value. */
export function StatGroup({ className, ...props }) {
  return <dl className={classNames(styles.group, className)} {...props} />
}

/** One number with its label. Goes inside a StatGroup. */
export function StatTile({ label, value, hint, icon, className, ...props }) {
  return (
    <div className={classNames(styles.tile, className)} {...props}>
      <dt className={styles.label}>
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </dt>
      <dd className={styles.value}>{value}</dd>
      {hint && <dd className={styles.hint}>{hint}</dd>}
    </div>
  )
}
