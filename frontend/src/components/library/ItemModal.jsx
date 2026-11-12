import { useId, useRef, useState } from 'react'
import { Alert } from '../feedback/Alert.jsx'
import { Modal } from '../feedback/Modal.jsx'
import { Input, Select } from '../forms/Field.jsx'
import { AddIcon } from '../icons.js'
import { Button } from '../ui/Button.jsx'
import { useAuthSubmit } from '../../hooks/useAuthSubmit.js'
import { ITEM_ERRORS, validateItem } from '../../rules/itemRules.js'
import { STATUSES } from '../../rules/statuses.js'
import styles from './ItemModal.module.css'

const FAILED_BODY = "Something went wrong on Savepoint's server. Try again."

const ADDING = {
  title: 'Add to your library',
  description: "You can log sessions and reflections once it's added.",
  submit: 'Add item',
  saving: 'Adding…',
  failed: "Couldn't add it",
}

const EDITING = {
  title: 'Edit details',
  description: 'Change the title, creator or type. Its status and history stay as they are.',
  submit: 'Save changes',
  saving: 'Saving…',
  failed: "Couldn't save your changes",
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
  const opening = useOpening(open)
  return (
    <ItemDialog
      key={opening}
      open={open}
      onClose={onClose}
      onSubmit={onSubmit}
      text={ADDING}
      icon={<AddIcon />}
      start={{ title: '', creator: '', medium: 'Book', status: 'Backlog' }}
    />
  )
}

/**
 * Changing an item's title, creator and type, with the same checks as adding
 * it. Status isn't here: the item's page changes that by itself.
 *
 * item: the item as it is now, which the form starts from each time it opens.
 * onSubmit receives { medium, title, creator }, as AddItemModal sends them, and
 * answers in the same way.
 */
export function EditItemModal({ open, item, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <ItemDialog
      key={opening}
      open={open}
      onClose={onClose}
      onSubmit={({ medium, title, creator }) => onSubmit({ medium, title, creator })}
      text={EDITING}
      start={{ title: item.title, creator: item.creator ?? '', medium: item.medium, status: null }}
    />
  )
}

// A new number each time open turns true. As a key, it gives the form fresh
// state for each opening: what was typed, its errors, and whether it's saving,
// which the button in the footer shows too.
function useOpening(open) {
  const [wasOpen, setWasOpen] = useState(open)
  const [opening, setOpening] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setOpening((count) => count + 1)
  }
  return opening
}

// The form both share. A start with no status leaves out the status field.
function ItemDialog({ open, onClose, onSubmit, text, icon, start }) {
  const formId = useId()
  const titleRef = useRef(null)
  const [values, setValues] = useState(start)
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
      title={text.title}
      description={text.description}
      initialFocusRef={titleRef}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={loading}>
            {icon}
            {loading ? text.saving : text.submit}
          </Button>
        </>
      }
    >
      {/* noValidate, so the browser's own popups don't replace these messages. */}
      <form id={formId} ref={formRef} noValidate className={styles.form} onSubmit={handleSubmit}>
        {serverError === 'failed' && (
          <Alert ref={alertRef} tabIndex={-1} tone="error" title={text.failed}>
            {FAILED_BODY}
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
        {values.status !== null && (
          <Select label="Status" value={values.status} onChange={update('status')}>
            {Object.entries(STATUSES).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </form>
    </Modal>
  )
}
