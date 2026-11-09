import { Card } from './Card.jsx'
import styles from './Skeleton.module.css'
import { classNames } from '../utils/classNames.js'

/**
 * Announces that its skeletons are loading. Screen readers can't see the shapes
 * themselves, so wrap them in this with a label saying what's on the way.
 */
export function SkeletonGroup({ label = 'Loading', className, children, ...props }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={className} {...props}>
      {children}
    </div>
  )
}

/**
 * A placeholder shape, shown where content will appear.
 *
 * variant: text (default, one line), circle, or block. Sizes are CSS lengths.
 */
export function Skeleton({ variant = 'text', width, height, className, style, ...props }) {
  return (
    <span
      aria-hidden="true"
      className={classNames(styles.skeleton, styles[variant], className)}
      style={{ width, height, ...style }}
      {...props}
    />
  )
}

/** Lines of placeholder text. The last is shorter, like the end of a paragraph. */
export function SkeletonText({ lines = 3 }) {
  return (
    <span className={styles.lines}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={lines > 1 && index === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
}

/** A card-shaped placeholder, for lists of items. */
export function SkeletonCard() {
  return (
    <Card className={styles.card}>
      <Skeleton variant="circle" width="48px" height="48px" />
      <span className={styles.cardBody}>
        <Skeleton width="45%" height="20px" />
        <SkeletonText lines={2} />
      </span>
    </Card>
  )
}
