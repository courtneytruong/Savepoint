import { useEffect, useId, useRef, useState } from 'react'
import fieldStyles from './Field.module.css'
import styles from './Combobox.module.css'
import { classNames } from './classNames.js'
import { filterOptions } from './textSearch.js'
import { ExpandIcon, FinishedIcon } from './icons.js'
import { Highlight } from './Highlight.jsx'
import { useAnchoredPopup } from './useAnchoredPopup.js'

/**
 * A text field that suggests options as you type, for choosing from a list too
 * long for a dropdown. Type to narrow the list, then pick with a click or with
 * the arrow keys and Enter. Esc, or leaving the field, keeps the last choice.
 *
 * options: { value, label, description?, icon? }, in the order to show them.
 * value and onChange: the chosen option's value. Always controlled.
 * error: shown under the field, as with the other fields.
 */
export function Combobox({
  label,
  options,
  value,
  onChange,
  placeholder,
  hint,
  error,
  emptyMessage = 'No matches',
  id,
  className,
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-list`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const inputRef = useRef(null)
  const popupRef = useRef(null)

  // query is null until the person types, and the field then shows the choice.
  const [query, setQuery] = useState(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const selected = options.find((option) => option.value === value)
  const results = query === null ? options : filterOptions(options, query)
  const optionId = (index) => `${inputId}-option-${index}`

  function showAll() {
    setQuery(null)
    setOpen(true)
    setActive(Math.max(options.indexOf(selected), 0))
  }

  function close() {
    setOpen(false)
    setQuery(null)
    setActive(-1)
  }

  function choose(option) {
    onChange(option.value)
    close()
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) showAll()
        else setActive((index) => Math.min(index + 1, results.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        if (open) setActive((index) => Math.max(index - 1, 0))
        break
      case 'Enter':
        if (open) {
          // Stops a surrounding form from submitting while the list is open.
          event.preventDefault()
          if (results[active]) choose(results[active])
        }
        break
      case 'Escape':
        if (open || query !== null) {
          // Only the list closes. A modal underneath stays open until the next Esc.
          event.preventDefault()
          event.stopPropagation()
          close()
        }
        break
    }
  }

  useAnchoredPopup(open, inputRef, popupRef)

  // Keeps the highlighted option in view as the arrow keys move through a long list.
  useEffect(() => {
    if (open && active >= 0) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
  })

  return (
    <div className={classNames(fieldStyles.field, error && fieldStyles.invalid, className)}>
      <label className={fieldStyles.label} htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? optionId(active) : undefined}
          aria-describedby={classNames(hint && hintId, error && errorId) || undefined}
          aria-invalid={error ? true : undefined}
          className={classNames(fieldStyles.control, styles.input)}
          placeholder={placeholder}
          value={query ?? selected?.label ?? ''}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          // Selecting the text on focus means typing replaces the current choice.
          onFocus={(event) => event.target.select()}
          onClick={() => !open && showAll()}
          onKeyDown={handleKeyDown}
          onBlur={close}
        />
        <button
          type="button"
          tabIndex={-1}
          className={styles.toggle}
          aria-label={`Show all: ${label}`}
          aria-expanded={open}
          aria-controls={listId}
          // Keeps focus in the field, so clicking here doesn't count as leaving it.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            inputRef.current.focus()
            if (open) close()
            else showAll()
          }}
        >
          <ExpandIcon aria-hidden="true" />
        </button>
      </div>
      {hint && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          {error}
        </p>
      )}

      <div ref={popupRef} popover="manual" data-open={open || undefined} className={styles.popup}>
        <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
          {open &&
            results.map((option, index) => (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                className={styles.option}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={() => choose(option)}
              >
                {option.icon && (
                  <span className={styles.icon} aria-hidden="true">
                    {option.icon}
                  </span>
                )}
                <span className={styles.text}>
                  <span className={styles.label}>
                    <Highlight text={option.label} query={query ?? ''} />
                  </span>
                  {option.description && <span className={styles.description}>{option.description}</span>}
                </span>
                {option.value === value && <FinishedIcon className={styles.current} role="img" aria-label="Current choice" />}
              </li>
            ))}
        </ul>
        {open && results.length === 0 && <p className={styles.empty}>{emptyMessage}</p>}
      </div>

      {/* Tells screen readers how many options match, as the person types. */}
      <p role="status" className={styles.visuallyHidden}>
        {open && query !== null ? `${results.length} ${results.length === 1 ? 'match' : 'matches'}` : ''}
      </p>
    </div>
  )
}
