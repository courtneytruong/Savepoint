import styles from './FilterPill.module.css'
import { classNames } from './classNames.js'
import { VisuallyHidden } from './VisuallyHidden.jsx'

/** Groups filter pills, and tells screen readers what they filter. */
export function FilterGroup({ label, className, ...props }) {
  return <div role="group" aria-label={label} className={classNames(styles.group, className)} {...props} />
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
