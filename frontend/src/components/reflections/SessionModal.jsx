import { useEffect, useId, useRef, useState } from 'react'
import { Alert } from '../feedback/Alert.jsx'
import { Modal } from '../feedback/Modal.jsx'
import { ReflectionIcon } from '../icons.js'
import { Button } from '../ui/Button.jsx'
import { useOpening } from '../../hooks/useOpening.js'
import { SessionForm } from './SessionForm.jsx'

const FAILED_BODY = "Something went wrong on Savepoint's server. Try again."

const LOGGING = {
  title: 'Log a session',
  description: (item) => `${item.title}: how long, and what you thought.`,
  submit: 'Log session',
  saving: 'Logging…',
  failed: "Couldn't log the session",
  icon: <ReflectionIcon />,
}

const EDITING = {
  title: 'Edit session',
  description: (item) => `${item.title}: change when, how long, or what you thought.`,
  submit: 'Save changes',
  saving: 'Saving…',
  failed: "Couldn't save your changes",
}

/**
 * Logging a session of one book or game, with its reflection, from that item's
 * page. The item is fixed, so there's no picker, and there are no tags until the
 * app saves them.
 *
 * item: { id, title, medium }. onSubmit receives what SessionForm gives, only once
 * it's valid, and returns a Promise. It resolves with { session } once logged,
 * which is when to close the modal, nothing when the page has dealt with it, or
 * { error: 'failed' }, shown above the form. If it throws, that counts as failed.
 *
 * A half-written reflection is easy to lose, so only Cancel closes it: not Esc,
 * the X or a click outside. Each opening starts empty.
 */
export function LogSessionModal({ open, item, onClose, onSubmit }) {
  const opening = useOpening(open)
  return <SessionDialog key={opening} open={open} item={item} onClose={onClose} onSubmit={onSubmit} text={LOGGING} />
}

/**
 * Changing a session and its reflection, with the same form and checks as logging
 * one, and answering in the same way.
 *
 * session: the session as it is now, in the API's shape, which the form starts
 * from each time it opens. Leave it out while closed.
 */
export function EditSessionModal({ open, item, session, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <SessionDialog
      key={opening}
      open={open}
      item={item}
      start={session}
      onClose={onClose}
      onSubmit={onSubmit}
      text={EDITING}
    />
  )
}

// The dialog both share. start: a session to start from, or none for a new one.
function SessionDialog({ open, item, start, onClose, onSubmit, text }) {
  const formId = useId()
  const alertRef = useRef(null)
  // editing, saving or failed.
  const [state, setState] = useState('editing')

  // Moves focus to the message, so it's read out and the form is right below it.
  useEffect(() => {
    if (state === 'failed') alertRef.current?.focus()
  }, [state])

  async function send(values) {
    if (state === 'saving') return
    setState('saving')
    let result
    try {
      result = await onSubmit(values)
    } catch {
      result = { error: 'failed' }
    }
    // On anything else, whoever opened this closes it.
    if (result?.error === 'failed') setState('failed')
  }

  const saving = state === 'saving'

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={false}
      title={text.title}
      description={text.description(item)}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {text.icon}
            {saving ? text.saving : text.submit}
          </Button>
        </>
      }
    >
      {state === 'failed' && (
        <Alert ref={alertRef} tabIndex={-1} tone="error" title={text.failed}>
          {FAILED_BODY}
        </Alert>
      )}
      <SessionForm
        id={formId}
        items={[item]}
        defaultItemId={item.id}
        defaultValue={start}
        itemLocked
        withTags={false}
        onSubmit={send}
      />
    </Modal>
  )
}
