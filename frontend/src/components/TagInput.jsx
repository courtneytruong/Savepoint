import { useEffect, useId, useRef, useState } from 'react'
import comboboxStyles from './Combobox.module.css'
import fieldStyles from './Field.module.css'
import styles from './TagInput.module.css'
import { classNames } from '../utils/classNames.js'
import { Highlight } from './Highlight.jsx'
import { AddIcon, CloseIcon } from './icons.js'
import { filterOptions, simplify } from '../utils/textSearch.js'
import { useAnchoredPopup } from '../hooks/useAnchoredPopup.js'

/** Spaces trimmed from the ends and runs of spaces inside made single. */
export const cleanTag = (text) => text.trim().replace(/\s+/g, ' ')

/**
 * Tags typed or picked one at a time, with existing tags suggested as you type so
 * the same tag gets reused rather than spelled a new way. Typing a tag that
 * exists in a different case or without its accents adds the existing one.
 *
 * Enter adds the highlighted suggestion, and a comma adds exactly what was typed.
 * Backspace in the empty field removes the last tag. Leaving the field adds
 * whatever was typed, so a tag can't be lost by pressing Save.
 *
 * value: the chosen tag names. suggestions: every existing tag name.
 */
export function TagInput({
  label = 'Tags',
  value,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag',
  hint,
  id,
  className,
}) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const listId = `${inputId}-list`
  const hintId = `${inputId}-hint`
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const popupRef = useRef(null)

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const typed = cleanTag(query)
  const isChosen = (name) => value.some((tag) => simplify(tag) === simplify(name))
  const existing = (name) => suggestions.find((tag) => simplify(tag) === simplify(name))

  const available = suggestions.filter((tag) => !isChosen(tag)).map((tag) => ({ value: tag, label: tag }))
  const matches = filterOptions(available, typed)
  // A new tag is only offered when nothing already has that name.
  const offerNew = typed !== '' && !existing(typed) && !isChosen(typed)
  const options = offerNew ? [...matches, { value: typed, label: typed, isNew: true }] : matches
  const emptyMessage = typed && isChosen(typed) ? `“${typed}” is already added` : 'No other tags yet'
  const showList = open && (options.length > 0 || typed !== '')
  const optionId = (index) => `${inputId}-option-${index}`

  useAnchoredPopup(showList, boxRef, popupRef)

  useEffect(() => {
    if (showList && options[active]) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
  })

  function add(name) {
    const clean = cleanTag(name)
    if (!clean) return false
    setQuery('')
    setActive(0)
    if (isChosen(clean)) {
      setAnnouncement(`${clean} is already added`)
      return false
    }
    const tag = existing(clean) ?? clean
    onChange([...value, tag])
    setAnnouncement(`Added ${tag}`)
    return true
  }

  function remove(tag) {
    onChange(value.filter((chosen) => chosen !== tag))
    setAnnouncement(`Removed ${tag}`)
  }

  function handleKeyDown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (!open) {
          setOpen(true)
          setActive(0)
        } else setActive((index) => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActive((index) => Math.max(index - 1, 0))
        break
      case 'Enter':
        // With nothing typed or highlighted, Enter is left to submit the form.
        if (showList && options[active]) {
          event.preventDefault()
          add(options[active].value)
        } else if (typed) {
          event.preventDefault()
          add(typed)
        }
        break
      case ',':
        event.preventDefault()
        add(typed)
        break
      case 'Backspace':
        if (query === '' && value.length > 0) remove(value[value.length - 1])
        break
      case 'Escape':
        if (showList) {
          // Only the list closes. A modal underneath stays open until the next Esc.
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }
        break
    }
  }

  return (
    <div className={classNames(fieldStyles.field, className)}>
      <label className={fieldStyles.label} htmlFor={inputId}>
        {label}
      </label>
      {/* Clicking anywhere in the box, such as between tags, goes to the field. */}
      <div
        ref={boxRef}
        className={styles.box}
        onMouseDown={(event) => {
          if (event.target === boxRef.current) {
            event.preventDefault()
            inputRef.current.focus()
          }
        }}
      >
        {value.length > 0 && (
          <ul className={styles.tags} aria-label={`Chosen ${label.toLowerCase()}`}>
            {value.map((tag) => (
              <li key={tag} className={styles.tag}>
                {tag}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Remove ${tag}`}
                  onClick={() => {
                    remove(tag)
                    // The button disappears, so focus would otherwise be lost.
                    inputRef.current.focus()
                  }}
                >
                  <CloseIcon aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          aria-describedby={hint ? hintId : undefined}
          className={styles.input}
          placeholder={value.length === 0 ? placeholder : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActive(0)
          }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            add(typed)
            setOpen(false)
          }}
        />
      </div>
      {hint && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}

      <div ref={popupRef} popover="manual" data-open={showList || undefined} className={comboboxStyles.popup}>
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className={comboboxStyles.list}>
          {showList &&
            options.map((option, index) => (
              <li
                key={option.isNew ? '\u0000new' : option.value}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                data-active={index === active || undefined}
                className={comboboxStyles.option}
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => index !== active && setActive(index)}
                onClick={() => add(option.value)}
              >
                {option.isNew && (
                  <span className={comboboxStyles.icon} aria-hidden="true">
                    <AddIcon />
                  </span>
                )}
                <span className={comboboxStyles.text}>
                  <span className={comboboxStyles.label}>
                    {option.isNew ? `New tag “${option.label}”` : <Highlight text={option.label} query={typed} />}
                  </span>
                </span>
              </li>
            ))}
        </ul>
        {showList && options.length === 0 && <p className={comboboxStyles.empty}>{emptyMessage}</p>}
      </div>

      {/* Tells screen readers what was added or removed, since it happens out of view of the field. */}
      <p role="status" className={comboboxStyles.visuallyHidden}>
        {announcement}
      </p>
    </div>
  )
}
