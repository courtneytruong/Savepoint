import { useId, useRef } from 'react'
import styles from './SearchField.module.css'
import { classNames } from '../../utils/classNames.js'
import { CloseIcon, SearchIcon } from '../icons.js'

/**
 * A search box. The label is read by screen readers but not shown, because the
 * icon and placeholder already say what it is. Typing something shows a button to
 * clear it, and Esc clears it too.
 *
 * value and onChange(text): always controlled.
 */
export function SearchField({ label, value, onChange, placeholder, className, ...props }) {
  const id = useId()
  const inputRef = useRef(null)

  function clear() {
    onChange('')
    inputRef.current.focus()
  }

  return (
    <div role="search" className={classNames(styles.search, className)}>
      <label htmlFor={id} className={styles.visuallyHidden}>
        {label}
      </label>
      <SearchIcon className={styles.icon} aria-hidden="true" />
      <input
        ref={inputRef}
        id={id}
        type="search"
        autoComplete="off"
        spellCheck={false}
        className={styles.input}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Only takes Esc when there's something to clear, so a modal can still close.
          if (event.key === 'Escape' && value) {
            event.preventDefault()
            event.stopPropagation()
            onChange('')
          }
        }}
        {...props}
      />
      {value && (
        <button type="button" className={styles.clear} aria-label="Clear search" onClick={clear}>
          <CloseIcon aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
