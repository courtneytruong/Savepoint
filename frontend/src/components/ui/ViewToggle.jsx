import { GridIcon, ListIcon } from '../icons.js'
import { IconToggle } from './IconToggle.jsx'

const VIEWS = [
  { value: 'list', label: 'List view', Icon: ListIcon },
  { value: 'grid', label: 'Grid view', Icon: GridIcon },
]

/** Switches the library between list and grid. */
export function ViewToggle(props) {
  return <IconToggle label="Library view" options={VIEWS} {...props} />
}
