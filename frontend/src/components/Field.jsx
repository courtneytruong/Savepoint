import { useId } from 'react'
import styles from './Field.module.css'
import { classNames } from './classNames.js'

/**
 * Connects a control to its label, hint and error, so screen readers announce
 * them along with the control.
 */
function Field({ as: Control, label, hint, error, id, className, ...controlProps }) {
  const generatedId = useId()
  const controlId = id ?? generatedId
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const describedBy = classNames(hint && hintId, error && errorId) || undefined

  return (
    <div className={classNames(styles.field, error && styles.invalid, className)}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      <Control
        id={controlId}
        className={styles.control}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...controlProps}
      />
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  )
}

export function Input(props) {
  return <Field as="input" {...props} />
}

export function Textarea({ rows = 5, ...props }) {
  return <Field as="textarea" rows={rows} {...props} />
}

/** Takes its options as children, like a normal select. */
export function Select(props) {
  return <Field as="select" {...props} />
}
