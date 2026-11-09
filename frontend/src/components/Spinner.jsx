import styles from './Spinner.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * Shows that something is working, when the shape of the result isn't known. For
 * content with a known layout, prefer a skeleton.
 *
 * size: small, medium (default), or large. The label is read by screen readers,
 * and also shown on screen with showLabel.
 */
export function Spinner({ size = 'medium', label = 'Loading', showLabel = false, className, ...props }) {
  return (
    <span role="status" className={classNames(styles.spinner, className)} {...props}>
      <span aria-hidden="true" className={classNames(styles.ring, styles[size])} />
      <span className={showLabel ? styles.label : styles.visuallyHidden}>{label}</span>
    </span>
  )
}
