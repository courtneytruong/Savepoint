import { Badge } from './Badge.jsx'
import { STATUSES } from '../rules/statuses.js'

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
