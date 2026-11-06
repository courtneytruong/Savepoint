import { useId, useState } from 'react'
import styles from './Field.module.css'
import { classNames } from './classNames.js'
import { HideIcon, ShowIcon } from './icons.js'

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

// The password box with its show/hide button. Field passes it the input's props.
function PasswordControl({ className, ...inputProps }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={styles.passwordWrap}>
      <input
        {...inputProps}
        type={visible ? 'text' : 'password'}
        // Spell check would send a visible password to the browser's spelling service.
        spellCheck={false}
        autoCapitalize="none"
        className={classNames(className, styles.passwordInput)}
      />
      {/* A toggle, so screen readers hear whether the password is showing. */}
      <button
        type="button"
        className={styles.reveal}
        aria-label="Show password"
        aria-pressed={visible}
        aria-controls={inputProps.id}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <HideIcon aria-hidden="true" /> : <ShowIcon aria-hidden="true" />}
      </button>
    </div>
  )
}

/**
 * A password, hidden until its button shows it, so it can be checked without
 * typing it twice. Pass autoComplete: current-password to sign in, or
 * new-password when creating one, so password managers fill or save it.
 */
export function PasswordField({ autoComplete = 'current-password', ...props }) {
  return <Field as={PasswordControl} autoComplete={autoComplete} {...props} />
}
