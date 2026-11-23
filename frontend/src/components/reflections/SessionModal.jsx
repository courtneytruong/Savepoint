import { FormModal } from '../feedback/FormModal.jsx'
import { ReflectionIcon } from '../icons.js'
import { useOpening } from '../../hooks/useOpening.js'
import { SessionForm } from './SessionForm.jsx'

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
 * Logging a session of one book or game, with its reflection and tags, from that
 * item's page. The item is fixed, so there's no picker.
 *
 * item: { id, title, medium }. tagSuggestions: the person's tag names. onSubmit
 * receives what SessionForm gives, only once it's valid, and returns a Promise. It
 * resolves with { session } once logged, which is when to close the modal, nothing
 * when the page has dealt with it, or { error: 'failed' }, shown above the form. If
 * it throws, that counts as failed.
 *
 * A half-written reflection is easy to lose, so only Cancel closes it: not Esc,
 * the X or a click outside. Each opening starts empty.
 */
export function LogSessionModal({ open, item, tagSuggestions, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <SessionDialog
      key={opening}
      open={open}
      item={item}
      tagSuggestions={tagSuggestions}
      onClose={onClose}
      onSubmit={onSubmit}
      text={LOGGING}
    />
  )
}

/**
 * Changing a session and its reflection, with the same form and checks as logging
 * one, and answering in the same way.
 *
 * session: the session as it is now, in the API's shape, which the form starts
 * from each time it opens. Leave it out while closed.
 */
export function EditSessionModal({ open, item, session, tagSuggestions, onClose, onSubmit }) {
  const opening = useOpening(open)
  return (
    <SessionDialog
      key={opening}
      open={open}
      item={item}
      start={session}
      tagSuggestions={tagSuggestions}
      onClose={onClose}
      onSubmit={onSubmit}
      text={EDITING}
    />
  )
}

// The dialog both share. start: a session to start from, or none for a new one.
function SessionDialog({ open, item, start, tagSuggestions, onClose, onSubmit, text }) {
  return (
    <FormModal
      open={open}
      text={{ ...text, description: text.description(item) }}
      onClose={onClose}
      onSubmit={onSubmit}
      form={(formId, send) => (
        <SessionForm
          id={formId}
          items={[item]}
          defaultItemId={item.id}
          defaultValue={start}
          itemLocked
          tagSuggestions={tagSuggestions}
          onSubmit={send}
        />
      )}
    />
  )
}
