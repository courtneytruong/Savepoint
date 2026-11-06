import { useId, useRef, useState } from 'react'
import { Textarea } from './Field.jsx'
import { SuccessIcon } from './icons.js'
import { MoodPicker } from './Mood.jsx'
import styles from './ReflectionForm.module.css'
import { TagInput } from './TagInput.jsx'
import { classNames } from './classNames.js'
import { showErrorsAndFocus } from './focusFirstProblem.js'
import { MIN_NOTES_LENGTH, notesLength, validateReflection } from './reflectionRules.js'

/** Counts toward the minimum as you type, then confirms once there's enough. */
function NotesCounter({ notes }) {
  const length = notesLength(notes)

  if (length < MIN_NOTES_LENGTH) {
    return (
      <span className={styles.counter}>
        {length} / {MIN_NOTES_LENGTH} characters
      </span>
    )
  }

  return (
    <span className={classNames(styles.counter, styles.enough)}>
      <SuccessIcon aria-hidden="true" />
      {length} characters
    </span>
  )
}

/**
 * The mood, notes and tags of a reflection, without a form around them, so a larger
 * form (such as logging a session) can include them. value is { mood, notes, tags },
 * and onChange receives the whole new value. tagSuggestions: every existing tag.
 */
export function ReflectionFields({ value, onChange, errors = {}, tagSuggestions }) {
  const moodName = `${useId()}-mood`

  return (
    <>
      <MoodPicker
        name={moodName}
        value={value.mood}
        onChange={(mood) => onChange({ ...value, mood })}
        error={errors.mood}
      />
      <Textarea
        label="Notes"
        name="notes"
        placeholder="What stood out, what frustrated you, where you left off…"
        value={value.notes}
        onChange={(event) => onChange({ ...value, notes: event.target.value })}
        hint={<NotesCounter notes={value.notes} />}
        error={errors.notes}
      />
      <TagInput
        value={value.tags}
        onChange={(tags) => onChange({ ...value, tags })}
        suggestions={tagSuggestions}
        hint="Optional. Press Enter or a comma after each one."
      />
    </>
  )
}

const EMPTY = { mood: null, notes: '', tags: [] }

/**
 * A standalone reflection, checked against the rules when saved. Errors only show
 * after the first try, then update as they're fixed. onSubmit receives
 * { mood, notes, tags } with the notes trimmed, and only when they're valid.
 *
 * The submit button can sit outside the form, such as in a modal's actions, by
 * giving it form={id}.
 */
export function ReflectionForm({ id, defaultValue, tagSuggestions, onSubmit, className, children }) {
  const [value, setValue] = useState({ ...EMPTY, ...defaultValue })
  const [triedToSave, setTriedToSave] = useState(false)
  const formRef = useRef(null)
  const errors = triedToSave ? validateReflection(value) : {}

  function handleSubmit(event) {
    event.preventDefault()
    const found = validateReflection(value)

    if (Object.keys(found).length > 0) {
      showErrorsAndFocus(formRef.current, () => setTriedToSave(true))
      return
    }

    onSubmit?.({ mood: value.mood, notes: value.notes.trim(), tags: value.tags })
  }

  return (
    // noValidate, so the browser's own popups don't replace these messages.
    <form id={id} ref={formRef} noValidate onSubmit={handleSubmit} className={classNames(styles.form, className)}>
      <ReflectionFields value={value} onChange={setValue} errors={errors} tagSuggestions={tagSuggestions} />
      {children}
    </form>
  )
}
