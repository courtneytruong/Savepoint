import { BacklogIcon, DroppedIcon, FinishedIcon, InProgressIcon } from '../components/icons.js'

// Keyed by the status values in docs/data-model.md.
export const STATUSES = {
  Backlog: { label: 'Backlog', tone: 'neutral', color: 'var(--color-muted-steel)', Icon: BacklogIcon },
  InProgress: { label: 'In progress', tone: 'accent', color: 'var(--color-lilac-beam)', Icon: InProgressIcon },
  Finished: { label: 'Finished', tone: 'success', color: 'var(--color-success)', Icon: FinishedIcon },
  Dropped: { label: 'Dropped', tone: 'dropped', color: 'var(--color-status-dropped)', Icon: DroppedIcon },
}
