import styles from './Badge.module.css'
import { classNames } from '../../utils/classNames.js'

/**
 * A small pill label, such as a status, mood or tag. It can hold an icon.
 *
 * tone: accent (default), neutral, success, warning, danger, or dropped (only
 * for the Dropped status).
 */
export function Badge({ tone = 'accent', className, ...props }) {
  return <span className={classNames(styles.badge, styles[tone], className)} {...props} />
}
