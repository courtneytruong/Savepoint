import styles from './Button.module.css'
import { classNames } from './classNames.js'

/**
 * A pill-shaped action. Passing href renders a link instead of a button.
 *
 * variant: primary (main action), outline (secondary), text (tertiary), or
 * danger (only for actions that delete something, usually to confirm it).
 */
export function Button({ variant = 'primary', href, type = 'button', className, ...props }) {
  const classes = classNames(styles.button, styles[variant], className)

  if (href) return <a href={href} className={classes} {...props} />

  // Browsers default to type="submit" inside a form, which would make every
  // button submit it. A submit button should have to say so.
  return <button type={type} className={classes} {...props} />
}
