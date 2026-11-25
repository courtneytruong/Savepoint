import { useId, useLayoutEffect, useRef, useState } from 'react'
import styles from './FilterPill.module.css'
import { classNames } from '../../utils/classNames.js'
import { Divider } from '../ui/Divider.jsx'
import { VisuallyHidden } from '../ui/VisuallyHidden.jsx'

/**
 * A line between two filter groups in a row that wraps. It shows only while the
 * groups either side of it share a row, so a group that has wrapped to the next
 * one doesn't start with a stray line. Checking the layout, rather than a fixed
 * width, means it suits groups of any size.
 */
export function FilterDivider({ className }) {
  const lineRef = useRef(null)
  const [shown, setShown] = useState(true)

  useLayoutEffect(() => {
    const line = lineRef.current
    function check() {
      const before = line.previousElementSibling?.getBoundingClientRect()
      const after = line.nextElementSibling?.getBoundingClientRect()
      // Sharing a row means overlapping from top to bottom.
      setShown(Boolean(before && after && after.top < before.bottom && before.top < after.bottom))
    }

    check()
    // Wrapping changes the row's size, whether from a resized window, a
    // collapsed sidebar or counts arriving, so that's when to check again.
    const observer = new ResizeObserver(check)
    observer.observe(line.parentElement)
    return () => observer.disconnect()
  }, [])

  // Hidden rather than removed, so it keeps its place and can't change how the
  // row wraps, which would make it flicker between the two.
  return (
    <Divider
      ref={lineRef}
      orientation="vertical"
      className={classNames(!shown && styles.dividerHidden, className)}
    />
  )
}

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
