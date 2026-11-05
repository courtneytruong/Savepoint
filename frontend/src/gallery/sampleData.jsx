import { buildTimeline, MediumLabel, MoodBadge, Rating, StatusBadge, toDateKey } from '../components/index.js'
import styles from './LibraryDemo.module.css'

// Sample data, until the real library feature exists.
export const SAMPLE_ITEMS = [
  {
    id: 1,
    title: 'The Left Hand of Darkness',
    creator: 'Ursula K. Le Guin',
    medium: 'Book',
    status: 'Finished',
    mood: 'Moved',
    rating: 9,
    excerpt: 'The crossing of the ice stayed with me long after the last page. I keep coming back to how trust is built.',
  },
  {
    id: 2,
    title: 'Hades',
    creator: 'Supergiant Games',
    medium: 'Game',
    status: 'InProgress',
    mood: 'Hooked',
    rating: 10,
    excerpt: 'One more run turned into three. Every failure still moves the story along, which keeps me coming back.',
  },
  {
    id: 3,
    title: 'Piranesi',
    creator: 'Susanna Clarke',
    medium: 'Book',
    status: 'Finished',
    mood: 'Curious',
    rating: 8,
    excerpt: 'I had no idea what was going on for the first hundred pages, and that turned out to be the point.',
  },
  {
    id: 4,
    title: 'Outer Wilds',
    creator: 'Mobius Digital',
    medium: 'Game',
    status: 'Finished',
    mood: 'Moved',
    rating: 10,
    excerpt: 'Nothing else has made me feel like this about a solar system. I wish I could forget it and start again.',
  },
  {
    id: 5,
    title: 'Dune',
    creator: 'Frank Herbert',
    medium: 'Book',
    status: 'InProgress',
    mood: 'Curious',
    rating: 7,
    excerpt: 'Slow going through the politics, but the world is so complete that I keep picking it back up.',
  },
  {
    id: 6,
    title: 'Disco Elysium',
    creator: 'ZA/UM',
    medium: 'Game',
    status: 'Backlog',
  },
  {
    id: 7,
    title: 'Middlemarch',
    creator: 'George Eliot',
    medium: 'Book',
    status: 'Dropped',
    mood: 'Bored',
    rating: 4,
    excerpt: 'I can see why people love it, but I stopped looking forward to picking it up. Maybe another year.',
  },
  {
    id: 8,
    title: 'Celeste',
    creator: 'Maddy Makes Games',
    medium: 'Game',
    status: 'Finished',
    mood: 'Delighted',
    rating: 9,
    excerpt: 'Hard in a way that never felt unfair. The summit chapter made me put the controller down for a minute.',
  },
  {
    id: 9,
    title: 'Klara and the Sun',
    creator: 'Kazuo Ishiguro',
    medium: 'Book',
    status: 'Finished',
    mood: 'Moved',
    rating: 8,
    excerpt: "Quiet the whole way through, then it hit me all at once. Klara's hope was the saddest part.",
  },
  {
    id: 10,
    title: 'Elden Ring',
    creator: 'FromSoftware',
    medium: 'Game',
    status: 'Dropped',
    mood: 'Frustrated',
    rating: 6,
    excerpt: 'Beautiful, but I spent more time lost than exploring. I might come back when I have more patience.',
  },
  {
    id: 11,
    title: 'Hyperion',
    creator: 'Dan Simmons',
    medium: 'Book',
    status: 'Backlog',
  },
]

// Statuses sort in the order an item moves through them, not alphabetically.
const STATUS_ORDER = ['Backlog', 'InProgress', 'Finished', 'Dropped']

export const SAMPLE_COLUMNS = [
  {
    key: 'title',
    header: 'Title',
    sortable: true,
    render: (item) => (
      <>
        <a href="#item" className={styles.title}>
          {item.title}
        </a>
        <span className={styles.creator}>{item.creator}</span>
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
    key: 'mood',
    header: 'Mood',
    hideOnMobile: true,
    sortable: true,
    render: (item) => item.mood && <MoodBadge mood={item.mood} />,
  },
  {
    key: 'rating',
    header: 'Rating',
    hideOnMobile: true,
    sortable: true,
    // Highest first is what you'd usually want from a rating.
    sortFirst: 'descending',
    render: (item) => item.rating !== undefined && <Rating value={item.rating} />,
  },
]

// For the grid view, which has no column headers to click.
export const SORT_OPTIONS = [
  ['Title, A to Z', { key: 'title', direction: 'ascending' }],
  ['Title, Z to A', { key: 'title', direction: 'descending' }],
  ['Rating, highest first', { key: 'rating', direction: 'descending' }],
  ['Rating, lowest first', { key: 'rating', direction: 'ascending' }],
  ['Status', { key: 'status', direction: 'ascending' }],
]

// Sessions over the last few weeks, counted back from today so the calendar demo
// always has something in the current month.
// [days ago, item, minutes, pages, mood, notes, { tags, loggedDaysLater }]
const SESSION_PLAN = [
  [0, 'Dune', 45, 38, 'Curious', 'The desert chapters finally clicked. Paul is starting to scare me a little.'],
  [1, 'Hades', 90, null, 'Hooked', 'Beat the second boss for the first time. Did three more runs straight after.', { tags: ['boss'] }],
  [1, 'Dune', 30, 22, 'Curious', 'Slow going through the politics again.'],
  [2, 'Celeste', 60, null, 'Frustrated', 'Stuck on the same screen for forty minutes. Took a break and got it first try.'],
  [4, 'Hades', 75, null, 'Delighted', 'A new weapon aspect changed how the whole run felt.'],
  [5, 'Klara and the Sun', 65, 80, 'Moved', 'Finished it. Quiet the whole way, then everything at once.', { tags: ['ending'] }],
  [5, 'Hades', 40, null, 'Hooked', 'Just one quick run before bed. It was not one.'],
  [5, 'Dune', 25, 18, 'Bored', 'Another council scene. Skimmed more than I meant to.'],
  [5, 'Celeste', 35, null, 'Delighted', 'The music in this chapter is wonderful.', { tags: ['music'] }],
  [5, 'Piranesi', 20, 15, 'Curious', 'Rereading the opening now that I know the ending.', { tags: ['reread'] }],
  [8, 'Klara and the Sun', 50, 64, 'Moved', 'The scene with the Sun at the barn. I had to stop for a bit.'],
  [9, 'Celeste', 55, null, 'Frustrated', 'Chapter 7 is relentless.'],
  [12, 'Elden Ring', 120, null, 'Frustrated', 'Lost again. I think I am done with this one for now.'],
  [15, 'Piranesi', 70, 92, 'Curious', 'The statues are starting to mean something.', { tags: ['statues', 'theory'] }],
  [19, 'Middlemarch', 40, 30, 'Bored', 'I keep putting it down. Maybe another year.'],
  [23, 'Outer Wilds', 110, null, 'Moved', 'The ending. I do not have words yet.', { tags: ['ending'], loggedDaysLater: 1 }],
  [27, 'Outer Wilds', 95, null, 'Curious', 'Found the quantum moon. My head hurts in a good way.', { tags: ['quantum moon'] }],
  [34, 'Hades', 60, null, 'Hooked', 'Started this on a whim.'],
]

const dayAgo = (today, daysAgo, hour = 0, minute = 0) =>
  new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo, hour, minute)

export function makeSampleSessions(today = new Date()) {
  return SESSION_PLAN.map(([daysAgo, itemTitle, durationMinutes, pagesRead, mood, notes, extra = {}], index) => {
    const item = SAMPLE_ITEMS.find((candidate) => candidate.title === itemTitle)
    return {
      id: index + 1,
      date: toDateKey(dayAgo(today, daysAgo)),
      // Sessions are logged in the evening, or on a later day if loggedDaysLater says so.
      createdAt: dayAgo(today, daysAgo - (extra.loggedDaysLater ?? 0), 20).toISOString(),
      itemTitle,
      medium: item.medium,
      durationMinutes,
      pagesRead,
      mood,
      notes,
      tags: extra.tags,
    }
  })
}

// Each item's history besides its sessions, in days ago. Starting is logged before
// that evening's session, and finishing or dropping after it.
const HISTORY_PLAN = {
  'The Left Hand of Darkness': {
    statuses: [
      [150, 'Backlog'],
      [130, 'InProgress'],
      [110, 'Finished'],
    ],
    ratings: [[110, 9]],
    reflections: [
      [109, 'Moved', 'The crossing of the ice stayed with me long after the last page. I keep coming back to how trust is built.', ['friendship']],
    ],
  },
  Hades: {
    statuses: [
      [40, 'Backlog'],
      [34, 'InProgress'],
    ],
    ratings: [
      [20, 8],
      [4, 10],
    ],
  },
  Piranesi: {
    statuses: [
      [50, 'Backlog'],
      [16, 'InProgress'],
      [14, 'Finished'],
    ],
    ratings: [
      [14, 7],
      [5, 8],
    ],
    reflections: [
      [14, 'Curious', 'I had no idea what was going on for the first hundred pages, and that turned out to be the point.', ['theory']],
    ],
  },
  'Outer Wilds': {
    statuses: [
      [60, 'Backlog'],
      [28, 'InProgress'],
      [22, 'Finished'],
    ],
    ratings: [[22, 10]],
    reflections: [
      [21, 'Moved', 'Nothing else has made me feel like this about a solar system. I wish I could forget it and start again.', ['ending', 'space']],
    ],
  },
  Dune: {
    statuses: [
      [90, 'Backlog'],
      [6, 'InProgress'],
    ],
    ratings: [[1, 7]],
  },
  'Disco Elysium': { statuses: [[3, 'Backlog']] },
  Middlemarch: {
    statuses: [
      [45, 'InProgress'],
      [19, 'Dropped'],
    ],
    ratings: [[19, 4]],
  },
  Celeste: {
    statuses: [
      [10, 'InProgress'],
      [2, 'Finished'],
    ],
    ratings: [[2, 9]],
  },
  'Klara and the Sun': {
    statuses: [
      [30, 'Backlog'],
      [9, 'InProgress'],
      [5, 'Finished'],
    ],
    ratings: [[5, 8]],
  },
  'Elden Ring': {
    statuses: [
      [70, 'Backlog'],
      [30, 'InProgress'],
      [12, 'Dropped'],
    ],
    ratings: [
      [25, 8],
      [12, 6],
    ],
    reflections: [
      [11, 'Frustrated', 'Beautiful, but I spent more time lost than exploring. I might come back when I have more patience.', []],
    ],
  },
  Hyperion: { statuses: [[18, 'Backlog']] },
}

// A short, fixed history with one of every kind of entry, for the gallery.
export const TIMELINE_EXAMPLE = buildTimeline({
  statusChanges: [
    { id: 1, status: 'Backlog', changedAt: '2026-09-02T18:00:00' },
    { id: 2, status: 'InProgress', changedAt: '2026-09-20T19:00:00' },
    { id: 3, status: 'Finished', changedAt: '2026-10-04T21:00:00' },
    { id: 4, status: 'InProgress', changedAt: '2026-10-25T19:00:00' },
  ],
  ratingChanges: [
    { id: 1, rating: 7, changedAt: '2026-10-04T21:30:00' },
    { id: 2, rating: 9, changedAt: '2026-10-26T21:30:00' },
  ],
  sessions: [
    {
      id: 1,
      date: '2026-09-20',
      createdAt: '2026-09-20T20:00:00',
      durationMinutes: 50,
      pagesRead: 40,
      reflection: { mood: 'Curious', notes: 'The house has tides. I have so many questions already.', tags: ['worldbuilding'] },
    },
    {
      id: 2,
      date: '2026-10-03',
      createdAt: '2026-10-04T09:00:00',
      durationMinutes: 95,
      pagesRead: 110,
      reflection: { mood: 'Moved', notes: 'Read the whole last part in one go, and logged it the morning after.' },
    },
  ],
  reflections: [
    {
      id: 1,
      mood: 'Delighted',
      notes: 'Better the second time. Knowing the ending made every small kindness land harder.',
      tags: ['reread'],
      createdAt: '2026-10-26T22:00:00',
    },
  ],
})

/** One item's history in the shape buildTimeline takes, as the API might send it. */
export function makeSampleHistory(itemTitle, sessions, today = new Date()) {
  const { statuses = [], ratings = [], reflections = [] } = HISTORY_PLAN[itemTitle] ?? {}
  const stamp = (daysAgo, hour, minute) => dayAgo(today, daysAgo, hour, minute).toISOString()

  return {
    statusChanges: statuses.map(([daysAgo, status], index) => ({
      id: index + 1,
      status,
      changedAt: stamp(daysAgo, status === 'InProgress' ? 19 : 21),
    })),
    ratingChanges: ratings.map(([daysAgo, rating], index) => ({ id: index + 1, rating, changedAt: stamp(daysAgo, 21, 30) })),
    sessions: sessions
      .filter((session) => session.itemTitle === itemTitle)
      .map(({ id, date, createdAt, durationMinutes, pagesRead, mood, notes, tags }) => ({
        id,
        date,
        createdAt,
        durationMinutes,
        pagesRead,
        reflection: { mood, notes, tags },
      })),
    reflections: reflections.map(([daysAgo, mood, notes, tags], index) => ({
      id: index + 1,
      mood,
      notes,
      tags,
      createdAt: stamp(daysAgo, 22),
    })),
  }
}
