import styles from './EmptyState.module.css'
import { classNames } from './classNames.js'
import { Heading, Text } from './Typography.jsx'

/**
 * Shown where content would be, saying why there's none and what to do next. It
 * has no frame of its own, so it can sit in a Card or a GlowFrame.
 *
 * Children are the description. headingAs sets the title's level in the page.
 */
export function EmptyState({ icon, title, action, headingAs = 'h2', className, children, ...props }) {
  return (
    <div className={classNames(styles.emptyState, className)} {...props}>
      {icon && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <Heading as={headingAs}>{title}</Heading>
      {children && <Text className={styles.description}>{children}</Text>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
