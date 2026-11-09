import styles from './ViewToggle.module.css'
import { classNames } from '../../utils/classNames.js'
import { GridIcon, ListIcon } from '../icons.js'
import { Tooltip } from './Tooltip.jsx'

const VIEWS = [
  { value: 'list', label: 'List view', Icon: ListIcon },
  { value: 'grid', label: 'Grid view', Icon: GridIcon },
]

/** Switches between list and grid. The buttons only have icons, so they're labelled. */
export function ViewToggle({ value, onChange, className, ...props }) {
  return (
    <div role="group" aria-label="Library view" className={classNames(styles.toggle, className)} {...props}>
      {VIEWS.map(({ value: view, label, Icon }) => (
        <Tooltip key={view} content={label}>
          <button
            type="button"
            aria-label={label}
            aria-pressed={value === view}
            className={classNames(styles.button, value === view && styles.selected)}
            onClick={() => onChange(view)}
          >
            <Icon aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
