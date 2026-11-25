import { useId } from 'react'
import styles from './FilterPill.module.css'
import { classNames } from '../../utils/classNames.js'
import { VisuallyHidden } from '../ui/VisuallyHidden.jsx'

/**
 * Groups filter pills, and tells screen readers what they filter.
 *
 * showLabel: shows the label above the pills too. The group is then named by
 * that text, so screen readers hear it once, and everyone can see what the
 * pills filter.
 */
export function FilterGroup({ label, showLabel = false, className, children, ...props }) {
  const labelId = useId()

  if (!showLabel) {
    return (
      <div role="group" aria-label={label} className={classNames(styles.group, className)} {...props}>
        {children}
      </div>
    )
  }

  return (
    <div role="group" aria-labelledby={labelId} className={classNames(styles.labelled, className)} {...props}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.group}>{children}</div>
    </div>
  )
}

/**
 * A filter that's either on or off. It can hold an icon, and show a count.
 * color: a CSS color, such as a mood's, used for its icon and when it's on.
 */
export function FilterPill({ selected = false, count, color, className, style, children, ...props }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={classNames(styles.pill, color && styles.colored, selected && styles.selected, className)}
      style={color ? { '--pill-color': color, ...style } : style}
      {...props}
    >
      {children}
      {count !== undefined && (
        <>
          {/* Without it, screen readers run the label and count together, as "Moved5". */}
          <VisuallyHidden>, </VisuallyHidden>
          <span className={styles.count}>{count}</span>
        </>
      )}
    </button>
  )
}
