import { SuccessIcon } from '../icons.js'
import styles from './LengthCounter.module.css'
import { classNames } from '../../utils/classNames.js'

/**
 * Counts toward a minimum length as you type, as in "7 / 12 characters", then
 * confirms once there's enough. Meant for a field's hint.
 */
export function LengthCounter({ length, min }) {
  if (length < min) {
    return (
      <span className={styles.counter}>
        {length} / {min} characters
      </span>
    )
  }

  return (
    <span className={classNames(styles.counter, styles.enough)}>
      <SuccessIcon aria-hidden="true" />
      {length} characters
    </span>
  )
}
