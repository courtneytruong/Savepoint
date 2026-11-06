import styles from './Alert.module.css'
import { classNames } from './classNames.js'
import { ErrorIcon, InfoIcon, SuccessIcon, WarningIcon } from './icons.js'

const ICONS = { error: ErrorIcon, warning: WarningIcon, success: SuccessIcon, info: InfoIcon }

/**
 * A message about a whole form or page, such as a sign-in that failed. For a
 * problem with one field, use that field's error instead.
 *
 * tone: error, warning, success or info. An error is announced as soon as it
 * appears; the others wait until the screen reader is free.
 *
 * Pass a ref, and tabIndex={-1}, to move focus to it after a failed submit, so
 * keyboard users land on the message.
 */
export function Alert({ tone = 'info', title, className, children, ...props }) {
  const Icon = ICONS[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={classNames(styles.alert, styles[tone], className)}
      {...props}
    >
      <Icon aria-hidden="true" className={styles.icon} />
      <div className={styles.text}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
    </div>
  )
}
