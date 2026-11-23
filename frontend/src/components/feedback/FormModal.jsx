import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '../ui/Button.jsx'
import { Alert } from './Alert.jsx'
import { Modal } from './Modal.jsx'

const FAILED_BODY = "Something went wrong on Savepoint's server. Try again."

/**
 * A modal around a form that saves to the server: Cancel and a submit button in its
 * actions, the button busy while saving, and a message above the form when saving
 * fails. What's being written is easy to lose, so only Cancel closes it: not Esc,
 * the X or a click outside.
 *
 * text: { title, description, submit, saving, failed, icon? }, the words for this
 * form. form(formId, send): the form, given the id its submit button points at and
 * the function to call with its values once they're valid.
 *
 * onSubmit receives those values and returns a Promise. It resolves with
 * { error: 'failed' } to show the message, or anything else when it has dealt with
 * it, such as by closing the modal. If it throws, that counts as failed.
 *
 * Give it a key that changes on each opening, so each one starts afresh.
 */
export function FormModal({ open, text, onClose, onSubmit, form }) {
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
      description={text.description}
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
      {form(formId, send)}
    </Modal>
  )
}
