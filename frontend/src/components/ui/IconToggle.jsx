import styles from './IconToggle.module.css'
import { classNames } from '../../utils/classNames.js'
import { Tooltip } from './Tooltip.jsx'

/**
 * A row of icon buttons where one is chosen, such as list or grid. The buttons
 * only have icons, so each option's label names its button and shows as a tooltip.
 *
 * label: what the group chooses, for screen readers.
 * options: [{ value, label, Icon }]. value: the chosen option's value.
 * onChange: called with the value of the option pressed.
 */
export function IconToggle({ label, options, value, onChange, className, ...props }) {
  return (
    <div role="group" aria-label={label} className={classNames(styles.toggle, className)} {...props}>
      {options.map(({ value: option, label: optionLabel, Icon }) => (
        <Tooltip key={option} content={optionLabel}>
          <button
            type="button"
            aria-label={optionLabel}
            aria-pressed={value === option}
            className={classNames(styles.button, value === option && styles.selected)}
            onClick={() => onChange(option)}
          >
            <Icon aria-hidden="true" />
          </button>
        </Tooltip>
      ))}
    </div>
  )
}
