import styles from './Section.module.css'
import { classNames } from './classNames.js'

/** A vertical band of the page, with its content kept to the page width. */
export function Section({ as: Element = 'section', centered = false, className, children, ...props }) {
  return (
    <Element className={classNames(styles.section, className)} {...props}>
      <div className={classNames(styles.inner, centered && styles.centered)}>{children}</div>
    </Element>
  )
}
