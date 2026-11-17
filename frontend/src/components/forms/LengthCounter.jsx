import { SuccessIcon } from '../icons.js'
import styles from './LengthCounter.module.css'
import { classNames } from '../../utils/classNames.js'

/**
 * Counts toward a minimum length as you type, as in "7 / 12 characters", then
 * confirms once there's enough. Given a max, it counts against that once past it,
 * as in "10,012 / 10,000 characters", without the tick. Meant for a field's hint.
 */
export function LengthCounter({ length, min, max }) {
  if (length < min || length > max) {
    return (
      <span className={styles.counter}>
        {length.toLocaleString()} / {(length < min ? min : max).toLocaleString()} characters
      </span>
    )
  }

  return (
    <span className={classNames(styles.counter, styles.enough)}>
      <SuccessIcon aria-hidden="true" />
      {length.toLocaleString()} characters
    </span>
  )
}
