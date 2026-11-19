import { useState } from 'react'
import { classNames } from '../../utils/classNames.js'
import { RatingIcon } from '../icons.js'
import { MAX_STARS, starsLabel } from '../../rules/ratingRules.js'
import styles from './StarRating.module.css'

const STARS = Array.from({ length: MAX_STARS }, (_, index) => index + 1)

/** A rating as five stars, the first value of them filled. Read out as one phrase. */
export function Stars({ value, className }) {
  return (
    <span
      role="img"
      aria-label={`Rated ${value} out of ${MAX_STARS} stars`}
      className={classNames(styles.stars, className)}
    >
      {STARS.map((star) => (
        <RatingIcon
          key={star}
          aria-hidden="true"
          data-filled={star <= value || undefined}
          className={classNames(styles.star, star <= value && styles.filled)}
        />
      ))}
    </span>
  )
}

/**
 * Picks a rating from 1 to 5 stars. Each star is its own button, pressed for the
 * current rating, so a press is a choice: arrow keys would choose on every step,
 * which saves a rating each time where pressing saves straight away. The stars
 * fill up to the one pointed at, to show what a press would choose.
 *
 * value: 1 to 5, or null when not rated yet, which says so beside the stars.
 * onChange: called with the number of stars pressed.
 * busy: while a choice saves, presses are ignored and the group says it's busy.
 */
export function StarRating({ value, onChange, busy = false, label = 'Rating', className }) {
  const [pointedAt, setPointedAt] = useState(null)
  const shown = pointedAt ?? value ?? 0

  return (
    <div className={classNames(styles.picker, className)}>
      <div
        role="group"
        aria-label={label}
        aria-busy={busy ? true : undefined}
        className={styles.buttons}
        onMouseLeave={() => setPointedAt(null)}
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            aria-label={starsLabel(star)}
            aria-pressed={value === star}
            aria-disabled={busy ? true : undefined}
            className={styles.button}
            onMouseEnter={() => setPointedAt(star)}
            onClick={() => {
              if (!busy) onChange(star)
            }}
          >
            <RatingIcon
              aria-hidden="true"
              data-filled={star <= shown || undefined}
              className={classNames(styles.star, star <= shown && styles.filled)}
            />
          </button>
        ))}
      </div>
      {value == null && <span className={styles.hint}>Not rated yet</span>}
    </div>
  )
}
