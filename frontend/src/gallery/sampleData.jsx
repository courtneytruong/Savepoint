import { MediumLabel, MoodBadge, Rating, StatusBadge, toDateKey } from '../components/index.js'
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
// always has something in the current month. [days ago, item, minutes, pages, mood, notes]
const SESSION_PLAN = [
  [0, 'Dune', 45, 38, 'Curious', 'The desert chapters finally clicked. Paul is starting to scare me a little.'],
  [1, 'Hades', 90, null, 'Hooked', 'Beat the second boss for the first time. Did three more runs straight after.'],
  [1, 'Dune', 30, 22, 'Curious', 'Slow going through the politics again.'],
  [2, 'Celeste', 60, null, 'Frustrated', 'Stuck on the same screen for forty minutes. Took a break and got it first try.'],
  [4, 'Hades', 75, null, 'Delighted', 'A new weapon aspect changed how the whole run felt.'],
  [5, 'Klara and the Sun', 50, 64, 'Moved', 'The scene with the Sun at the barn. I had to stop for a bit.'],
  [5, 'Hades', 40, null, 'Hooked', 'Just one quick run before bed. It was not one.'],
  [5, 'Dune', 25, 18, 'Bored', 'Another council scene. Skimmed more than I meant to.'],
  [5, 'Celeste', 35, null, 'Delighted', 'The music in this chapter is wonderful.'],
  [5, 'Piranesi', 20, 15, 'Curious', 'Rereading the opening now that I know the ending.'],
  [8, 'Klara and the Sun', 65, 80, 'Moved', 'Finished it. Quiet the whole way, then everything at once.'],
  [9, 'Celeste', 55, null, 'Frustrated', 'Chapter 7 is relentless.'],
  [12, 'Elden Ring', 120, null, 'Frustrated', 'Lost again. I think I am done with this one for now.'],
  [15, 'Piranesi', 70, 92, 'Curious', 'The statues are starting to mean something.'],
  [19, 'Middlemarch', 40, 30, 'Bored', 'I keep putting it down. Maybe another year.'],
  [23, 'Outer Wilds', 110, null, 'Moved', 'The ending. I do not have words yet.'],
  [27, 'Outer Wilds', 95, null, 'Curious', 'Found the quantum moon. My head hurts in a good way.'],
  [34, 'Hades', 60, null, 'Hooked', 'Started this on a whim.'],
]

export function makeSampleSessions(today = new Date()) {
  return SESSION_PLAN.map(([daysAgo, itemTitle, durationMinutes, pagesRead, mood, notes], index) => {
    const item = SAMPLE_ITEMS.find((candidate) => candidate.title === itemTitle)
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysAgo)
    return { id: index + 1, date: toDateKey(date), itemTitle, medium: item.medium, durationMinutes, pagesRead, mood, notes }
  })
}
