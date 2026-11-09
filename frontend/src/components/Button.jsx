import styles from './Button.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * A pill-shaped action. Passing href renders a link instead of a button.
 *
 * variant: primary (main action), outline (secondary), text (tertiary), or
 * danger (only for actions that delete something, usually to confirm it).
 *
 * loading: shows a spinner and ignores presses, such as while signing in. Change
 * the words too, as in "Signing in…", so everyone knows what's happening. It
 * isn't disabled, because a disabled button loses focus, and keyboard users
 * would be sent back to the top of the page.
 */
export function Button({ variant = 'primary', href, type = 'button', loading = false, className, onClick, children, ...props }) {
  const classes = classNames(styles.button, styles[variant], loading && styles.loading, className)

  if (href) {
    return (
      <a href={href} className={classes} onClick={onClick} {...props}>
        {children}
      </a>
    )
  }

  function handleClick(event) {
    // Stops a second press while the first is still working, including a
    // second submit of the form.
    if (loading) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  // Browsers default to type="submit" inside a form, which would make every
  // button submit it. A submit button should have to say so.
  return (
    <button
      type={type}
      className={classes}
      aria-disabled={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}
