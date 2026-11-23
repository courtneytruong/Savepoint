import { NewestFirstIcon, OldestFirstIcon } from '../icons.js'
import { IconToggle } from '../ui/IconToggle.jsx'

// The ways round a timeline can be read, as Timeline's order values.
const ORDERS = [
  { value: 'newest', label: 'Newest first', Icon: NewestFirstIcon },
  { value: 'oldest', label: 'Oldest first', Icon: OldestFirstIcon },
]

/** The newest first / oldest first switch for a timeline, as useTimelineOrder remembers it. */
export function TimelineOrderToggle({ value, onChange }) {
  return <IconToggle label="Timeline order" options={ORDERS} value={value} onChange={onChange} />
}
