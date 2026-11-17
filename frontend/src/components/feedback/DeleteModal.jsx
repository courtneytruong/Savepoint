import { useState } from 'react'
import { Alert } from './Alert.jsx'
import { Modal } from './Modal.jsx'
import { DeleteIcon } from '../icons.js'
import { Button } from '../ui/Button.jsx'
import { useOpening } from '../../hooks/useOpening.js'

const FAILED_BODY = "Something went wrong on Savepoint's server. Try again."

/**
 * Asks before deleting something, since that can't be undone: "Keep it" to back
 * out, or a red Delete.
 *
 * title: the question, such as "Delete Piranesi?". description: what goes with it.
 * onConfirm deletes it and returns a Promise of { deleted: true }, after which
 * whoever opened this moves on, or { error: 'failed' }, shown in the modal. If it
 * throws, that counts as failed. Each opening starts without the last one's error.
 */
export function DeleteModal({ open, title, description, onClose, onConfirm }) {
  const opening = useOpening(open)
  return (
    <DeleteDialog
      key={opening}
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  )
}

function DeleteDialog({ open, title, description, onClose, onConfirm }) {
  // asking, deleting or failed.
  const [state, setState] = useState('asking')

  async function confirm() {
    if (state === 'deleting') return
    setState('deleting')
    let result
    try {
      result = await onConfirm()
    } catch {
      result = { error: 'failed' }
    }
    if (!result?.deleted) setState('failed')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={state === 'deleting'} onClick={confirm}>
            <DeleteIcon />
            {state === 'deleting' ? 'Deleting…' : 'Delete'}
          </Button>
        </>
      }
    >
      {state === 'failed' && (
        <Alert tone="error" title="Couldn't delete it">
          {FAILED_BODY}
        </Alert>
      )}
    </Modal>
  )
}
