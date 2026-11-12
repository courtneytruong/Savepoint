import { Link, MediumLabel, StatusBadge } from '../components/index.js'
import { itemPath } from '../paths.js'
import styles from './LibraryPage.module.css'

// Statuses sort in the order an item moves through them, not alphabetically.
const STATUS_ORDER = ['Backlog', 'InProgress', 'Finished', 'Dropped']

// In the reader's own language and calendar, such as "12 Nov 2026".
const addedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

/**
 * The library's list view. Each title links to the item's own page. Mood and
 * rating join once reflections and ratings exist.
 */
export const LIBRARY_COLUMNS = [
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    render: (item) => (
      <>
        <Link href={itemPath(item.id)} className={styles.title}>
          {item.title}
        </Link>
        {item.creator && <span className={styles.creator}>{item.creator}</span>}
      </>
    ),
  },
  {
    key: 'medium',
    header: 'Type',
    hideOnMobile: true,
    sortable: true,
    render: (item) => <MediumLabel medium={item.medium} />,
  },
  {
    key: 'status',
    header: 'Status',
    sortable: true,
    sortValue: (item) => STATUS_ORDER.indexOf(item.status),
    render: (item) => <StatusBadge status={item.status} />,
  },
  {
    key: 'createdAt',
    header: 'Added',
    hideOnMobile: true,
    sortable: true,
    // Newest first is what you'd usually want from a date.
    sortFirst: 'descending',
    sortValue: (item) => Date.parse(item.createdAt),
    render: (item) => <time dateTime={item.createdAt}>{addedDate.format(new Date(item.createdAt))}</time>,
  },
]

/** For the grid view, which has no column headers to click. The first is the default. */
export const SORT_OPTIONS = [
  ['Recently added', { key: 'createdAt', direction: 'descending' }],
  ['Oldest first', { key: 'createdAt', direction: 'ascending' }],
  ['Title, A to Z', { key: 'title', direction: 'ascending' }],
  ['Title, Z to A', { key: 'title', direction: 'descending' }],
  ['Status', { key: 'status', direction: 'ascending' }],
]

export const MEDIUM_FILTERS = [
  ['All', null],
  ['Books', 'Book'],
  ['Games', 'Game'],
]

export const STATUS_FILTERS = [
  ['Any status', null],
  ['Backlog', 'Backlog'],
  ['In progress', 'InProgress'],
  ['Finished', 'Finished'],
  ['Dropped', 'Dropped'],
]
