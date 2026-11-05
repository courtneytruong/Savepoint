import styles from './Divider.module.css'
import { classNames } from './classNames.js'

/**
 * A line between pieces of content.
 *
 * variant: hairline (default, plain), fade (fades out at both ends), or beam
 * (a bright line of violet light, for a major break).
 * orientation: horizontal (default) or vertical, which needs a parent with height.
 */
export function Divider({ variant = 'hairline', orientation = 'horizontal', className, ...props }) {
  return (
    <hr
      aria-orientation={orientation === 'vertical' ? 'vertical' : undefined}
      className={classNames(styles.divider, styles[variant], styles[orientation], className)}
      {...props}
    />
  )
}
