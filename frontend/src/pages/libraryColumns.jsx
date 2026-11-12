import { MediumLabel, StatusBadge } from '../components/index.js'
import styles from './LibraryPage.module.css'

// Statuses sort in the order an item moves through them, not alphabetically.
const STATUS_ORDER = ['Backlog', 'InProgress', 'Finished', 'Dropped']

/**
 * The library's list view. Mood and rating join once reflections and ratings
 * exist, and the title becomes a link once items have their own page.
 */
export const LIBRARY_COLUMNS = [
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    render: (item) => (
      <>
        <span className={styles.title}>{item.title}</span>
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
]
