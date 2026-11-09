import { useState } from 'react'
import {
  buildTimeline,
  Combobox,
  EmptyState,
  FilterGroup,
  FilterPill,
  Heading,
  MediumLabel,
  Rating,
  Select,
  StatusBadge,
  Timeline,
} from '../components/index.js'
import { BookIcon, GameIcon, NoResultsIcon } from '../components/icons.js'
import styles from './LibraryDemo.module.css'
import { makeSampleHistory, SAMPLE_ITEMS } from './sampleData.jsx'

// Alphabetical, so the full list is easy to scan. Searching also matches the creator.
const ITEM_OPTIONS = SAMPLE_ITEMS.map((item) => ({
  value: item.id,
  label: item.title,
  description: item.creator,
  icon: item.medium === 'Game' ? <GameIcon /> : <BookIcon />,
})).sort((a, b) => a.label.localeCompare(b.label))

const KINDS = [
  ['Everything', null],
  ['Sessions', ['session']],
  ['Reflections', ['reflection']],
  ['Status and rating', ['status', 'rating']],
]

/** One item's timeline, with a choice of item, what to show and which way round. */
export function TimelinePage({ sessions }) {
  const [itemId, setItemId] = useState(3)
  const [kinds, setKinds] = useState(null)
  const [order, setOrder] = useState('newest')

  const item = SAMPLE_ITEMS.find((candidate) => candidate.id === itemId)
  const entries = buildTimeline(makeSampleHistory(item.title, sessions))
  const shown = kinds ? entries.filter((entry) => kinds.includes(entry.type)) : entries

  // An item's current status and rating are simply its newest changes.
  const status = entries.findLast((entry) => entry.type === 'status')?.status
  const rating = entries.findLast((entry) => entry.type === 'rating')?.rating

  return (
    <div>
      <div className={styles.toolbar}>
        <Heading as="h2">Timeline</Heading>
        <Combobox
          label="Item"
          className={styles.picker}
          placeholder="Search your library"
          options={ITEM_OPTIONS}
          value={itemId}
          onChange={setItemId}
          emptyMessage="Nothing in your library matches that"
        />
      </div>
      <div className={styles.summary}>
        <div>
          <p className={styles.summaryTitle}>{item.title}</p>
          <p className={styles.creator}>{item.creator}</p>
        </div>
        <div className={styles.summaryBadges}>
          <MediumLabel medium={item.medium} />
          {status && <StatusBadge status={status} />}
          {rating !== undefined && <Rating value={rating} />}
        </div>
      </div>
      <div className={styles.filters}>
        <FilterGroup label="Show">
          {KINDS.map(([label, value]) => (
            <FilterPill key={label} selected={kinds === value} onClick={() => setKinds(value)}>
              {label}
            </FilterPill>
          ))}
        </FilterGroup>
        <Select
          label="Order"
          className={styles.sort}
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </Select>
      </div>
      <div className={styles.page}>
        <Timeline
          entries={shown}
          medium={item.medium}
          order={order}
          empty={
            kinds && (
              <EmptyState icon={<NoResultsIcon />} title="Nothing of that kind yet" headingAs="h3">
                {item.title} has nothing to show here. Try showing everything instead.
              </EmptyState>
            )
          }
        />
      </div>
    </div>
  )
}
