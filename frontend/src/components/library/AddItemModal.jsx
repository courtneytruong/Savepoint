import { useId, useRef, useState } from 'react'
import { Alert } from '../feedback/Alert.jsx'
import { Modal } from '../feedback/Modal.jsx'
import { Input, Select } from '../forms/Field.jsx'
import { AddIcon } from '../icons.js'
import { Button } from '../ui/Button.jsx'
import { useAuthSubmit } from '../../hooks/useAuthSubmit.js'
import { ITEM_ERRORS, validateItem } from '../../rules/itemRules.js'
import { STATUSES } from '../../rules/statuses.js'
import styles from './AddItemModal.module.css'

const FAILED = {
  title: "Couldn't add it",
  body: "Something went wrong on Savepoint's server. Try again.",
}

/**
 * Adding a book or game: its title, creator, type and the status to start at,
 * checked against the rules in docs/data-model.md before anything is sent.
 *
 * onSubmit receives { medium, title, creator, status }, with the title and
 * creator trimmed and an empty creator as null, and returns a Promise. It
 * resolves with nothing or { item } once added, which is when to close the modal,
 * or { error: 'failed' }, shown above the form. If it throws, that counts as
 * failed.
 *
 * Each time it opens, the form starts empty.
 */
export function AddItemModal({ open, onClose, onSubmit }) {
  // A new key for each opening gives the form fresh state: what was typed, its
  // errors, and whether it's saving, which the button in the footer shows too.
  const [wasOpen, setWasOpen] = useState(open)
  const [opening, setOpening] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpening((count) => count + 1)
  }

  return <AddItemDialog key={opening} open={open} onClose={onClose} onSubmit={onSubmit} />
}

function AddItemDialog({ open, onClose, onSubmit }) {
  const formId = useId()
  const titleRef = useRef(null)
  const [values, setValues] = useState({ title: '', creator: '', medium: 'Book', status: 'Backlog' })
  const { errors, serverError, loading, handleSubmit, formRef, alertRef } = useAuthSubmit({
    values,
    validate: validateItem,
    send: () =>
      onSubmit({
        medium: values.medium,
        title: values.title.trim(),
        creator: values.creator.trim() || null,
        status: values.status,
      }),
    knownErrors: ITEM_ERRORS,
    formErrors: ITEM_ERRORS,
  })

  const update = (field) => (event) => setValues({ ...values, [field]: event.target.value })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to your library"
      description="You can log sessions and reflections once it's added."
      initialFocusRef={titleRef}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={loading}>
            <AddIcon />
            {loading ? 'Adding…' : 'Add item'}
          </Button>
        </>
      }
    >
      {/* noValidate, so the browser's own popups don't replace these messages. */}
      <form id={formId} ref={formRef} noValidate className={styles.form} onSubmit={handleSubmit}>
        {serverError === 'failed' && (
          <Alert ref={alertRef} tabIndex={-1} tone="error" title={FAILED.title}>
            {FAILED.body}
          </Alert>
        )}
        <Input
          ref={titleRef}
          label="Title"
          placeholder="The Left Hand of Darkness"
          value={values.title}
          onChange={update('title')}
          error={errors.title}
        />
        <Input
          label="Creator"
          hint="The author or the studio. Optional."
          value={values.creator}
          onChange={update('creator')}
          error={errors.creator}
        />
        <Select label="Type" value={values.medium} onChange={update('medium')}>
          <option value="Book">Book</option>
          <option value="Game">Game</option>
        </Select>
        <Select label="Status" value={values.status} onChange={update('status')}>
          {Object.entries(STATUSES).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </form>
    </Modal>
  )
}
