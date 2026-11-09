import { useId, useRef, useState } from 'react'
import { toDateKey } from '../../utils/calendarDates.js'
import { classNames } from '../../utils/classNames.js'
import { Combobox } from '../forms/Combobox.jsx'
import { Input } from '../forms/Field.jsx'
import fieldStyles from '../forms/Field.module.css'
import { showErrorsAndFocus } from '../../utils/focusFirstProblem.js'
import { BookIcon, GameIcon } from '../icons.js'
import { ReflectionFields } from './ReflectionForm.jsx'
import { validateReflection } from '../../rules/reflectionRules.js'
import styles from './SessionForm.module.css'
import { sessionMinutes, validateSession } from '../../rules/sessionRules.js'

/**
 * Logging a session: what, when, for how long, and the reflection that every
 * session needs. It's one form because the API saves both together, so neither
 * can be saved without the other.
 *
 * items: { id, title, creator, medium }. defaultItemId picks one to start with,
 * such as when logging from an item's own page. onSubmit receives
 * { itemId, date, durationMinutes, pagesRead, reflection: { mood, notes, tags } },
 * only once everything is valid. pagesRead is null if not given, and always for games.
 *
 * As with ReflectionForm, the submit button can sit outside, given form={id}.
 */
export function SessionForm({
  id,
  items,
  defaultItemId = null,
  tagSuggestions,
  onSubmit,
  today: fixedToday,
  className,
  children,
}) {
  const durationErrorId = `${useId()}-duration-error`
  const formRef = useRef(null)
  // Read once, so "today" can't change between renders.
  const [today] = useState(() => fixedToday ?? new Date())
  const todayKey = toDateKey(today)

  const [session, setSession] = useState({
    itemId: defaultItemId,
    date: todayKey,
    hours: '',
    minutes: '',
    pagesRead: '',
  })
  const [reflection, setReflection] = useState({ mood: null, notes: '', tags: [] })
  const [triedToSave, setTriedToSave] = useState(false)

  const item = items.find((candidate) => candidate.id === session.itemId)
  const isBook = item?.medium === 'Book'
  const check = () => ({
    ...validateSession(session, { medium: item?.medium, today }),
    ...validateReflection(reflection),
  })
  const errors = triedToSave ? check() : {}
  const update = (field) => (event) => setSession({ ...session, [field]: event.target.value })

  const itemOptions = items
    .map((candidate) => ({
      value: candidate.id,
      label: candidate.title,
      description: candidate.creator,
      icon: candidate.medium === 'Game' ? <GameIcon /> : <BookIcon />,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  function handleSubmit(event) {
    event.preventDefault()
    if (Object.keys(check()).length > 0) {
      showErrorsAndFocus(formRef.current, () => setTriedToSave(true))
      return
    }

    const pages = session.pagesRead.trim()
    onSubmit?.({
      itemId: session.itemId,
      date: session.date,
      durationMinutes: sessionMinutes(session),
      pagesRead: isBook && pages !== '' ? Number(pages) : null,
      reflection: { mood: reflection.mood, notes: reflection.notes.trim(), tags: reflection.tags },
    })
  }

  return (
    // noValidate, so the browser's own popups don't replace these messages.
    <form id={id} ref={formRef} noValidate onSubmit={handleSubmit} className={classNames(styles.form, className)}>
      <Combobox
        label="Book or game"
        placeholder="Search your library"
        options={itemOptions}
        value={session.itemId}
        onChange={(itemId) => setSession({ ...session, itemId })}
        error={errors.itemId}
      />

      <div className={styles.when}>
        <Input
          label="Date"
          type="date"
          max={todayKey}
          value={session.date}
          onChange={update('date')}
          error={errors.date}
        />

        <fieldset
          className={styles.duration}
          aria-describedby={errors.duration ? durationErrorId : undefined}
          data-invalid={errors.duration ? true : undefined}
        >
          <legend className={fieldStyles.label}>Time spent</legend>
          <div className={styles.durationFields}>
            {[
              ['hours', 'Hours'],
              ['minutes', 'Minutes'],
            ].map(([field, label]) => (
              <Input
                key={field}
                label={label}
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                placeholder="0"
                value={session[field]}
                onChange={update(field)}
                className={classNames(errors.duration && fieldStyles.invalid)}
                aria-invalid={errors.duration ? true : undefined}
                aria-describedby={errors.duration ? durationErrorId : undefined}
              />
            ))}
          </div>
          {errors.duration && (
            <p id={durationErrorId} className={classNames(fieldStyles.error, styles.groupError)}>
              {errors.duration}
            </p>
          )}
        </fieldset>
      </div>

      {/* Only books count pages, so the field only shows for one. */}
      {isBook && (
        <Input
          label="Pages read"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          hint="Optional."
          className={styles.pages}
          value={session.pagesRead}
          onChange={update('pagesRead')}
          error={errors.pagesRead}
        />
      )}

      <div className={styles.reflection}>
        <h3 className={styles.reflectionTitle}>Your reflection</h3>
        <ReflectionFields
          value={reflection}
          onChange={setReflection}
          errors={errors}
          tagSuggestions={tagSuggestions}
        />
      </div>
      {children}
    </form>
  )
}
