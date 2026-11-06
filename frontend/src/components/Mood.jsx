import { useId } from 'react'
import styles from './Mood.module.css'
import { classNames } from './classNames.js'
import { MOODS, moodFor } from './moods.js'

/** A mood, in its own color and with its own icon. */
export function MoodBadge({ mood, className, ...props }) {
  const { color, Icon } = moodFor(mood)

  return (
    <span className={classNames(styles.badge, className)} style={{ '--mood-color': color }} {...props}>
      <Icon aria-hidden="true" />
      {mood}
    </span>
  )
}

/**
 * Choosing a mood, as a set of colored radio buttons. Works like any radio group:
 * pass value and onChange to control it, or defaultValue to leave it to the form.
 * An error shows under the choices and is read out with the group.
 */
export function MoodPicker({
  name = 'mood',
  label = 'Mood',
  value,
  defaultValue,
  onChange,
  required,
  error,
  className,
}) {
  const errorId = `${useId()}-error`

  return (
    <fieldset
      className={classNames(styles.picker, className)}
      aria-describedby={error ? errorId : undefined}
      data-invalid={error ? true : undefined}
    >
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.options}>
        {MOODS.map(({ value: mood, color, Icon }) => (
          <label key={mood} className={styles.option} style={{ '--mood-color': color }}>
            <input
              type="radio"
              name={name}
              value={mood}
              required={required}
              className={styles.radio}
              {...(value === undefined
                ? { defaultChecked: defaultValue === mood }
                : { checked: value === mood, onChange: () => onChange?.(mood) })}
            />
            <Icon aria-hidden="true" />
            {mood}
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </fieldset>
  )
}
