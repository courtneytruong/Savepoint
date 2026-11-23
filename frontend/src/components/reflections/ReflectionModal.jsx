import { FormModal } from '../feedback/FormModal.jsx'
import { WriteReflectionIcon } from '../icons.js'
import { useOpening } from '../../hooks/useOpening.js'
import { ReflectionForm } from './ReflectionForm.jsx'

const WRITING = {
  title: 'Write a reflection',
  description: (item) => `${item.title}: a thought about it as a whole, not about one session.`,
  submit: 'Save reflection',
  saving: 'Saving…',
  failed: "Couldn't save the reflection",
  icon: <WriteReflectionIcon />,
}

const EDITING = {
  title: 'Edit reflection',
  description: (item) => `${item.title}: change what you thought.`,
  submit: 'Save changes',
  saving: 'Saving…',
  failed: "Couldn't save your changes",
}

/**
 * Writing a reflection about one book or game that isn't about any session, such
 * as a final thought or a review, from that item's page: a mood, notes and tags.
 *
 * item: { id, title }. tagSuggestions: the person's tag names. onSubmit receives
 * { mood, notes, tags } with the notes trimmed, only once they're valid, and returns
 * a Promise. It resolves with { reflection } once saved, which is when to close
 * the modal, nothing when the page has dealt with it, or { error: 'failed' },
 * shown above the form. If it throws, that counts as failed.
 *
 * As for a session, only Cancel closes it, and each opening starts empty.
 */
export function WriteReflectionModal({ open, item, tagSuggestions, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <ReflectionDialog
      key={opening}
      open={open}
      item={item}
      tagSuggestions={tagSuggestions}
      onClose={onClose}
      onSubmit={onSubmit}
      text={WRITING}
    />
  )
}

/**
 * Changing a standalone reflection, with the same form and checks as writing one,
 * and answering in the same way.
 *
 * reflection: as it is now, in the API's shape, which the form starts from each
 * time it opens. Leave it out while closed.
 */
export function EditReflectionModal({ open, item, reflection, tagSuggestions, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <ReflectionDialog
      key={opening}
      open={open}
      item={item}
      start={reflection && { mood: reflection.mood, notes: reflection.notes, tags: reflection.tags }}
      tagSuggestions={tagSuggestions}
      onClose={onClose}
      onSubmit={onSubmit}
      text={EDITING}
    />
  )
}

// The dialog both share. start: a reflection to start from, or none for a new one.
function ReflectionDialog({ open, item, start, tagSuggestions, onClose, onSubmit, text }) {
  return (
    <FormModal
      open={open}
      text={{ ...text, description: text.description(item) }}
      onClose={onClose}
      onSubmit={onSubmit}
      form={(formId, send) => (
        <ReflectionForm id={formId} defaultValue={start} tagSuggestions={tagSuggestions} onSubmit={send} />
      )}
    />
  )
}
