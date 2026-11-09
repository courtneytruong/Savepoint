import styles from './Card.module.css'
import { classNames } from '../utils/classNames.js'
import { Horizon } from './Horizon.jsx'

/**
 * A content surface.
 *
 * variant: surface (main content), frosted (smaller callouts), or overlay
 * (small and floating, on top of something else).
 */
export function Card({ as: Element = 'div', variant = 'surface', className, ...props }) {
  return <Element className={classNames(styles.card, styles[variant], className)} {...props} />
}

/**
 * A large glass panel with purple light rising from behind its top edge. Use
 * flush when the content, such as a table, should reach the panel's edges.
 */
export function GlowFrame({ flush = false, className, children, ...props }) {
  return (
    <div className={classNames(styles.glowFrame, className)} {...props}>
      <Horizon />
      <div className={classNames(styles.glowFrameContent, !flush && styles.padded)}>{children}</div>
    </div>
  )
}
