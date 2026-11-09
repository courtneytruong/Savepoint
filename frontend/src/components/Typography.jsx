import styles from './Typography.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * A heading. Size is how it looks, and `as` is its level in the page outline,
 * so they can be chosen separately.
 *
 * size: display, large, medium (wide-tracked label style), or small.
 */
export function Heading({ as: Element = 'h2', size = 'small', className, ...props }) {
  return <Element className={classNames(styles.heading, styles[size], className)} {...props} />
}

/**
 * Running text.
 *
 * size: caption, body, or subheading (best for reading longer passages).
 * tone: muted (default), steel, strong, or faint. Faint is too low in contrast
 * for cards, so only use it directly on the page background.
 */
export function Text({ as: Element = 'p', size = 'body', tone = 'muted', className, ...props }) {
  return <Element className={classNames(styles.text, styles[size], styles[tone], className)} {...props} />
}
