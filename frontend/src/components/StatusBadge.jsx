import { Badge } from './Badge.jsx'
import { BacklogIcon, DroppedIcon, FinishedIcon, InProgressIcon } from './icons.js'

// Keyed by the status values in docs/data-model.md.
const STATUSES = {
  Backlog: { label: 'Backlog', tone: 'neutral', Icon: BacklogIcon },
  InProgress: { label: 'In progress', tone: 'accent', Icon: InProgressIcon },
  Finished: { label: 'Finished', tone: 'success', Icon: FinishedIcon },
  Dropped: { label: 'Dropped', tone: 'dropped', Icon: DroppedIcon },
}

/** An item's status, with its color, icon and readable name. */
export function StatusBadge({ status, ...props }) {
  const { label, tone, Icon } = STATUSES[status]

  return (
    <Badge tone={tone} {...props}>
      <Icon aria-hidden="true" />
      {label}
    </Badge>
  )
}
