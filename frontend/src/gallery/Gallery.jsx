import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AddIcon,
  ArrowIcon,
  BacklogIcon,
  BookIcon,
  CalendarIcon,
  CloseIcon,
  DeleteIcon,
  DroppedIcon,
  ErrorIcon,
  FilterIcon,
  FinishedIcon,
  GameIcon,
  GridIcon,
  InfoIcon,
  InProgressIcon,
  LibraryIcon,
  ListIcon,
  NextIcon,
  NoResultsIcon,
  PreviousIcon,
  RatingIcon,
  ReflectionIcon,
  SearchIcon,
  SettingsIcon,
  SortAscendingIcon,
  SortDescendingIcon,
  SortIcon,
  SuccessIcon,
  TimeIcon,
  TimelineIcon,
} from '../components/icons.js'
import {
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  FilterGroup,
  FilterPill,
  Footer,
  GlowFrame,
  Header,
  Heading,
  Hero,
  Input,
  Modal,
  MoodBadge,
  MoodPicker,
  MOODS,
  Pagination,
  ReflectionCard,
  ReflectionForm,
  Section,
  SessionForm,
  Select,
  Sidebar,
  SidebarGroup,
  SidebarLayout,
  SidebarLink,
  Skeleton,
  SkeletonCard,
  SkeletonGroup,
  SkeletonText,
  Spinner,
  StatGroup,
  StatTile,
  StatusBadge,
  Table,
  Text,
  Textarea,
  Timeline,
  Tooltip,
  useToast,
} from '../components/index.js'
import styles from './Gallery.module.css'
import { CalendarPage } from './CalendarPage.jsx'
import { LibraryDemo } from './LibraryDemo.jsx'
import { ReflectionsPage } from './ReflectionsPage.jsx'
import { TimelinePage } from './TimelinePage.jsx'
import { Palette } from './Palette.jsx'
import { makeSampleReflections, makeSampleSessions, SAMPLE_COLUMNS, SAMPLE_ITEMS, SAMPLE_TAGS, TIMELINE_EXAMPLE } from './sampleData.jsx'

const STATUSES = ['Backlog', 'InProgress', 'Finished', 'Dropped']

const ICONS = [
  ['Add', AddIcon],
  ['Arrow', ArrowIcon],
  ['Close', CloseIcon],
  ['Book', BookIcon],
  ['Game', GameIcon],
  ['Library', LibraryIcon],
  ['Timeline', TimelineIcon],
  ['Reflection', ReflectionIcon],
  ['Rating', RatingIcon],
  ['Time', TimeIcon],
  ['Filter', FilterIcon],
  ['Search', SearchIcon],
  ['No results', NoResultsIcon],
  ['Settings', SettingsIcon],
  ['List view', ListIcon],
  ['Grid view', GridIcon],
  ['Sort', SortIcon],
  ['Sorted up', SortAscendingIcon],
  ['Sorted down', SortDescendingIcon],
  ['Previous', PreviousIcon],
  ['Next', NextIcon],
  ['Delete', DeleteIcon],
  ['Calendar', CalendarIcon],
  ...MOODS.map(({ value, Icon }) => [value, Icon]),
  ['Backlog', BacklogIcon],
  ['In progress', InProgressIcon],
  ['Finished', FinishedIcon],
  ['Dropped', DroppedIcon],
  ['Success', SuccessIcon],
  ['Info', InfoIcon],
  ['Error', ErrorIcon],
]

function Group({ title, children }) {
  return (
    <div className={styles.group}>
      <Text size="caption">{title}</Text>
      <div className={styles.row}>{children}</div>
    </div>
  )
}

function AddItemModal({ open, onClose, onSaved }) {
  const titleRef = useRef(null)

  function handleSubmit(event) {
    event.preventDefault()
    const title = new FormData(event.currentTarget).get('title') || 'Your new item'
    onClose()
    onSaved(title)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to your library"
      description="You can log sessions and reflections once it's added."
      initialFocusRef={titleRef}
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-item">
            <AddIcon />
            Add item
          </Button>
        </>
      }
    >
      <form id="add-item" className={styles.modalForm} onSubmit={handleSubmit}>
        <Input ref={titleRef} name="title" label="Title" placeholder="The Left Hand of Darkness" />
        <Input name="creator" label="Creator" hint="The author or the studio." />
        <Select name="medium" label="Type" defaultValue="Book">
          <option>Book</option>
          <option>Game</option>
        </Select>
      </form>
    </Modal>
  )
}

// The gallery has no router, so the panel's page comes from the address, as in
// /components#calendar. The browser's back button then works too.
const PAGES = ['library', 'reflections', 'timeline', 'calendar']
const pageFromAddress = () => {
  const page = window.location.hash.slice(1)
  return PAGES.includes(page) ? page : 'library'
}

function useAddressPage() {
  const [page, setPage] = useState(pageFromAddress)

  useEffect(() => {
    const update = () => setPage(pageFromAddress())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])

  return page
}

/** Every component in every state. Only exists in development, at /components. */
export default function Gallery() {
  const toast = useToast()
  const [sessions] = useState(() => makeSampleSessions())
  const reflectionCount = useMemo(() => makeSampleReflections(sessions).length, [sessions])
  const page = useAddressPage()
  const panelRef = useRef(null)
  const current = (name) => (page === name ? 'page' : undefined)

  // A link at the other end of the page, such as in the footer, brings the panel into view.
  useEffect(() => {
    const panel = panelRef.current?.getBoundingClientRect()
    if (panel && (panel.top < 0 || panel.top > window.innerHeight)) panelRef.current.scrollIntoView({ block: 'start' })
  }, [page])
  const [addOpen, setAddOpen] = useState(false)
  const [reflectionOpen, setReflectionOpen] = useState(false)
  const [sessionOpen, setSessionOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)

  const openAddItem = () => setAddOpen(true)

  return (
    <>
      <Header
        brand="Savepoint"
        actions={
          <Button variant="text">
            <SettingsIcon />
            Settings
          </Button>
        }
      >
        <a href="#library" aria-current={current('library')}>
          Library
        </a>
        <a href="#timeline" aria-current={current('timeline')}>
          Timeline
        </a>
        <a href="#calendar" aria-current={current('calendar')}>
          Calendar
        </a>
        <a href="#reflections" aria-current={current('reflections')}>
          Reflections
        </a>
      </Header>

      <main>
        <Hero
          panel={
            <GlowFrame flush ref={panelRef}>
              <SidebarLayout
                sidebar={
                  <Sidebar>
                    <SidebarGroup>
                      <SidebarLink href="#library" icon={<LibraryIcon />} count={11} active={page === 'library'}>
                        Library
                      </SidebarLink>
                      <SidebarLink href="#timeline" icon={<TimelineIcon />} active={page === 'timeline'}>
                        Timeline
                      </SidebarLink>
                      <SidebarLink href="#calendar" icon={<CalendarIcon />} active={page === 'calendar'}>
                        Calendar
                      </SidebarLink>
                      <SidebarLink
                        href="#reflections"
                        icon={<ReflectionIcon />}
                        count={reflectionCount}
                        active={page === 'reflections'}
                      >
                        Reflections
                      </SidebarLink>
                    </SidebarGroup>
                    <SidebarGroup title="Browse">
                      <SidebarLink href="#books" icon={<BookIcon />} count={6}>
                        Books
                      </SidebarLink>
                      <SidebarLink href="#games" icon={<GameIcon />} count={5}>
                        Games
                      </SidebarLink>
                    </SidebarGroup>
                  </Sidebar>
                }
              >
                {page === 'calendar' ? (
                  <CalendarPage sessions={sessions} />
                ) : page === 'reflections' ? (
                  <ReflectionsPage sessions={sessions} />
                ) : page === 'timeline' ? (
                  <TimelinePage sessions={sessions} />
                ) : (
                  <LibraryDemo onAddItem={openAddItem} />
                )}
              </SidebarLayout>
            </GlowFrame>
          }
        >
          <Heading as="h1" size="display">
            Every thought, in order
          </Heading>
          <Text size="subheading" className={styles.lead}>
            A journal for the books you read and the games you play, and how your thinking changes along the way.
          </Text>
          <Button onClick={openAddItem}>
            Add your first item
            <ArrowIcon />
          </Button>
        </Hero>

        <Palette />

        <Section>
          <Heading size="medium">Typography</Heading>
          <Heading as="h3" size="display">
            Display
          </Heading>
          <Heading as="h3" size="large">
            Large
          </Heading>
          <Heading as="h3" size="medium">
            Medium
          </Heading>
          <Heading as="h3" size="small">
            Small
          </Heading>
          <Text size="subheading">Subheading text, for reading longer passages like a reflection.</Text>
          <Text>Body text in the default muted tone.</Text>
          <Text size="caption">Caption text.</Text>
          <Group title="Tones">
            <Text tone="strong">Strong</Text>
            <Text tone="steel">Steel</Text>
            <Text tone="muted">Muted</Text>
            <Text tone="faint">Faint</Text>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Buttons</Heading>
          <Group title="Variants">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="text">Text</Button>
          </Group>
          <Group title="Danger (only for deleting something)">
            <Button variant="danger">
              <DeleteIcon />
              Remove
            </Button>
            <Button variant="danger" disabled>
              Remove
            </Button>
          </Group>
          <Group title="Disabled">
            <Button disabled>Primary</Button>
            <Button variant="outline" disabled>
              Outline
            </Button>
            <Button variant="text" disabled>
              Text
            </Button>
          </Group>
          <Group title="With icons">
            <Button>
              Add item
              <AddIcon />
            </Button>
            <Button variant="outline">
              <FilterIcon />
              Filter
            </Button>
            <Button variant="text">
              <SettingsIcon />
              Settings
            </Button>
          </Group>
          <Group title="As a link">
            <Button href="#library">Go to library</Button>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Modals</Heading>
          <Group title="Try them">
            <Button onClick={openAddItem}>Form</Button>
            <Button variant="outline" onClick={() => setReflectionOpen(true)}>
              Write a reflection
            </Button>
            <Button variant="outline" onClick={() => setSessionOpen(true)}>
              Log a session
            </Button>
            <Button variant="outline" onClick={() => setRemoveOpen(true)}>
              Confirmation
            </Button>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Tooltips</Heading>
          <Group title="Hover, or move to them with Tab">
            <Tooltip content="Settings">
              <Button variant="outline" aria-label="Settings">
                <SettingsIcon />
              </Button>
            </Tooltip>
            <Tooltip content="Remove from your library">
              <Button variant="danger" aria-label="Remove">
                <DeleteIcon />
              </Button>
            </Tooltip>
            <Tooltip content="Shown below instead" placement="bottom">
              <Button variant="outline">Below</Button>
            </Tooltip>
            <Tooltip content="A longer hint wraps onto more lines, so it never runs off the screen or gets too wide to read comfortably.">
              <Button variant="outline">Long text</Button>
            </Tooltip>
            <Tooltip content="Your rating out of 10, from your latest change">
              <button type="button" className={styles.infoButton} aria-label="About ratings">
                <InfoIcon aria-hidden="true" />
              </button>
            </Tooltip>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Toasts</Heading>
          <Group title="Try them">
            <Button
              onClick={() =>
                toast.show({
                  title: 'Reflection saved',
                  description: 'Added to the timeline for Piranesi.',
                })
              }
            >
              Success
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.show({
                  tone: 'info',
                  title: 'Dune marked as finished',
                  action: { label: 'Undo', onClick: () => toast.show({ tone: 'info', title: 'Back to In progress' }) },
                })
              }
            >
              Info with undo
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.show({
                  tone: 'error',
                  title: "Couldn't save your reflection",
                  description: 'Check your connection and try again. Your notes are still here.',
                })
              }
            >
              Error (stays until dismissed)
            </Button>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Tables</Heading>
          <Group title="Loading" />
          <Card className={styles.flushCard}>
            <Table caption="items" columns={SAMPLE_COLUMNS} loading loadingRows={3} />
          </Card>
          <Group title="Sortable: click a column header" />
          <Card className={styles.flushCard}>
            <Table
              caption="A sample of your library"
              columns={SAMPLE_COLUMNS}
              rows={SAMPLE_ITEMS.slice(0, 5)}
              defaultSort={{ key: 'rating', direction: 'descending' }}
            />
          </Card>
          <Group title="Empty" />
          <Card className={styles.flushCard}>
            <Table
              caption="Your library"
              columns={SAMPLE_COLUMNS}
              rows={[]}
              empty={
                <EmptyState icon={<LibraryIcon />} title="Your library is empty" headingAs="h3">
                  Add a book or game to get started.
                </EmptyState>
              }
            />
          </Card>
        </Section>

        <Section>
          <Heading size="medium">Timeline</Heading>
          <Group title="Every kind of entry, oldest first" />
          <Card>
            <Timeline entries={TIMELINE_EXAMPLE} medium="Book" order="oldest" />
          </Card>
          <div className={styles.grid}>
            <div className={styles.stack}>
              <Group title="Loading" />
              <Card>
                <Timeline loading />
              </Card>
            </div>
            <div className={styles.stack}>
              <Group title="Empty" />
              <Card>
                <Timeline entries={[]} />
              </Card>
            </div>
          </div>
        </Section>

        <Section>
          <Heading size="medium">Reflection cards</Heading>
          <Group title="With the item, as on the Reflections page" />
          <div className={styles.grid}>
            <ReflectionCard
              item={{ title: 'Piranesi', medium: 'Book', href: '#item' }}
              date="2026-11-04"
              session={{ durationMinutes: 75, pagesRead: 48 }}
              mood="Curious"
              notes="The house has tides. I have so many questions already, and the statues feel like they mean something."
              tags={['worldbuilding', 'statues']}
            />
            <ReflectionCard
              item={{ title: 'Outer Wilds', medium: 'Game', href: '#item' }}
              date="2026-10-28"
              mood="Moved"
              notes="Nothing has made me feel this small and this lucky at once."
              tags={['ending']}
            />
          </div>
          <Group title="Without it, as on an item's timeline" />
          <div className={styles.grid}>
            <ReflectionCard
              medium="Game"
              session={{ durationMinutes: 140 }}
              mood="Frustrated"
              notes="Third run in a row lost to the same boss. I know the pattern, my hands just don't yet."
              tags={['boss']}
              loggedOn="2026-11-05T09:00:00"
            />
            <ReflectionCard medium="Game" mood="Delighted" notes="Worth every failed run. The music alone." />
          </div>
        </Section>

        <Section>
          <Heading size="medium">Pagination</Heading>
          <PaginationDemo />
        </Section>

        <Section>
          <Heading size="medium">Stat tiles</Heading>
          <StatGroup>
            <StatTile icon={<BookIcon />} label="Books finished" value="12" hint="3 this year" />
            <StatTile icon={<GameIcon />} label="Games finished" value="8" hint="1 this year" />
            <StatTile icon={<TimeIcon />} label="Time logged" value="214h" />
            <StatTile icon={<ReflectionIcon />} label="Reflections" value="96" hint="Most often: Curious" />
          </StatGroup>
        </Section>

        <Section>
          <Heading size="medium">Filter pills</Heading>
          <PillDemo />
        </Section>

        <Section>
          <Heading size="medium">Dividers</Heading>
          <Group title="Hairline" />
          <Divider />
          <Group title="Fade" />
          <Divider variant="fade" />
          <Group title="Beam" />
          <Divider variant="beam" />
          <Group title="Vertical">
            <div className={styles.verticalDemo}>
              <Text>Books</Text>
              <Divider orientation="vertical" variant="fade" />
              <Text>Games</Text>
              <Divider orientation="vertical" />
              <Text>Reflections</Text>
            </div>
          </Group>
        </Section>

        <Section>
          <Heading size="medium">Icons</Heading>
          <div className={styles.icons}>
            {ICONS.map(([name, Icon]) => (
              <div key={name} className={styles.icon}>
                <Icon />
                <Text size="caption">{name}</Text>
              </div>
            ))}
          </div>
        </Section>

        <Section>
          <Heading size="medium">Badges</Heading>
          <Group title="Moods: each has its own color and icon">
            {MOODS.map(({ value }) => (
              <MoodBadge key={value} mood={value} />
            ))}
          </Group>
          <Group title="Statuses">
            {STATUSES.map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </Group>
          <Group title="All tones">
            <Badge>Accent</Badge>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
          </Group>
          <Card>
            <Group title="On a card">
              <MoodBadge mood="Moved" />
              <Badge tone="neutral">Backlog</Badge>
              <Badge tone="success">Finished</Badge>
              <Badge tone="warning">Dropped</Badge>
              <Badge tone="danger">Error</Badge>
            </Group>
          </Card>
        </Section>

        <Section>
          <Heading size="medium">Loading</Heading>
          <Group title="Spinner sizes">
            <Spinner size="small" />
            <Spinner />
            <Spinner size="large" />
            <Spinner label="Loading your library" showLabel />
          </Group>
          <div className={styles.grid}>
            <SkeletonGroup label="Loading items" className={styles.stack}>
              <SkeletonCard />
              <SkeletonCard />
            </SkeletonGroup>
            <SkeletonGroup label="Loading reflection">
              <Card className={styles.stack}>
                <Skeleton width="40%" height="24px" />
                <SkeletonText lines={4} />
                <Skeleton variant="block" width="100%" height="96px" />
              </Card>
            </SkeletonGroup>
          </div>
        </Section>

        <Section>
          <Heading size="medium">Empty states</Heading>
          <div className={styles.grid}>
            <Card>
              <EmptyState
                icon={<LibraryIcon />}
                title="Your library is empty"
                headingAs="h3"
                action={
                  <Button onClick={openAddItem}>
                    Add your first item
                    <ArrowIcon />
                  </Button>
                }
              >
                Add a book or game you're reading or playing, and start building its timeline.
              </EmptyState>
            </Card>
            <Card>
              <EmptyState
                icon={<NoResultsIcon />}
                title="Nothing matches those filters"
                headingAs="h3"
                action={<Button variant="outline">Clear filters</Button>}
              >
                Try removing a filter or searching for something else.
              </EmptyState>
            </Card>
            <Card>
              <EmptyState
                icon={<ReflectionIcon />}
                title="No reflections yet"
                headingAs="h3"
                action={
                  <Button variant="outline" onClick={() => setReflectionOpen(true)}>
                    <AddIcon />
                    Write a reflection
                  </Button>
                }
              >
                What stood out? What frustrated you? Where did you leave off?
              </EmptyState>
            </Card>
          </div>
        </Section>

        <Section>
          <Heading size="medium">Cards</Heading>
          <div className={styles.grid}>
            <Card>
              <Heading as="h3">Surface</Heading>
              <Text>For main content, like an item in the library.</Text>
            </Card>
            <Card variant="frosted">
              <Heading as="h3">Frosted</Heading>
              <Text>For smaller callouts, lighter than the main content.</Text>
            </Card>
          </div>
          <Card variant="overlay" className={styles.overlay}>
            <Text size="caption" tone="strong">
              Overlay: 12 sessions
            </Text>
          </Card>
        </Section>

        <Section>
          <Heading size="medium">Form fields</Heading>
          <Card as="form" className={styles.form}>
            <Input label="Title" placeholder="The Left Hand of Darkness" />
            <Input label="Creator" hint="The author or the studio." />
            <MoodPicker name="example-mood" defaultValue="Curious" />
            <Textarea
              label="Notes"
              defaultValue="Too short"
              hint="At least 20 characters."
              error="Write a little more: notes need at least 20 characters."
            />
            <Input label="Disabled" defaultValue="Can't change this" disabled />
          </Card>
        </Section>
      </main>

      <Footer
        brand="Savepoint"
        note="A journal for the books you read and the games you play. Everything you write stays on your own computer."
        bottom="Savepoint, version 0.1"
      >
        <a href="#library" aria-current={current('library')}>
          Library
        </a>
        <a href="#timeline" aria-current={current('timeline')}>
          Timeline
        </a>
        <a href="#calendar" aria-current={current('calendar')}>
          Calendar
        </a>
        <a href="#settings">Settings</a>
      </Footer>

      <AddItemModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(title) => toast.show({ title: `${title} added to your library` })}
      />

      <Modal
        open={reflectionOpen}
        onClose={() => setReflectionOpen(false)}
        title="Write a reflection"
        description="Esc and clicking outside won't close this, so your words can't be lost by accident."
        dismissible={false}
        actions={
          <>
            <Button variant="text" onClick={() => setReflectionOpen(false)}>
              Discard
            </Button>
            {/* Sits outside the form, in the modal's actions, so it names the form it submits. */}
            <Button type="submit" form="reflection-form">
              Save reflection
            </Button>
          </>
        }
      >
        <ReflectionForm
          id="reflection-form"
          tagSuggestions={SAMPLE_TAGS}
          onSubmit={({ mood }) => {
            setReflectionOpen(false)
            toast.show({ title: `${mood} reflection saved` })
          }}
        >
          <div>
            <Tooltip content="Tooltips show above modals too">
              <button type="button" className={styles.infoButton} aria-label="About this modal">
                <InfoIcon aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        </ReflectionForm>
      </Modal>

      <Modal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        title="Log a session"
        description="Every session gets a reflection, saved together with it."
        dismissible={false}
        actions={
          <>
            <Button variant="text" onClick={() => setSessionOpen(false)}>
              Discard
            </Button>
            <Button type="submit" form="session-form">
              Save session
            </Button>
          </>
        }
      >
        <SessionForm
          id="session-form"
          items={SAMPLE_ITEMS}
          tagSuggestions={SAMPLE_TAGS}
          onSubmit={({ itemId }) => {
            setSessionOpen(false)
            toast.show({ title: `Session logged for ${SAMPLE_ITEMS.find((item) => item.id === itemId).title}` })
          }}
        />
      </Modal>

      <Modal
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        title="Remove Middlemarch?"
        description="This also removes its sessions and reflections, and can't be undone."
        actions={
          <>
            <Button variant="text" onClick={() => setRemoveOpen(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setRemoveOpen(false)
                toast.show({ tone: 'info', title: 'Middlemarch removed' })
              }}
            >
              <DeleteIcon />
              Remove
            </Button>
          </>
        }
      />
    </>
  )
}

function PaginationDemo() {
  const [page, setPage] = useState(7)
  const pageSize = 20
  const total = 470
  const pageCount = Math.ceil(total / pageSize)

  return (
    <Card>
      <Pagination
        label="Example pages"
        page={page}
        pageCount={pageCount}
        first={(page - 1) * pageSize + 1}
        last={Math.min(page * pageSize, total)}
        total={total}
        onPageChange={setPage}
      />
    </Card>
  )
}

function PillDemo() {
  const [selected, setSelected] = useState(['Moved', 'Curious'])

  function toggle(mood) {
    setSelected((current) => (current.includes(mood) ? current.filter((value) => value !== mood) : [...current, mood]))
  }

  return (
    <>
      <Group title="Click to turn on and off">
        <FilterGroup label="Example: filter by mood">
          {MOODS.map(({ value, color, Icon }, index) => (
            <FilterPill
              key={value}
              color={color}
              selected={selected.includes(value)}
              count={(index + 2) * 3}
              onClick={() => toggle(value)}
            >
              <Icon aria-hidden="true" />
              {value}
            </FilterPill>
          ))}
        </FilterGroup>
      </Group>
      <Group title="With icons">
        <FilterGroup label="Example: filter by type">
          <FilterPill selected>
            <BookIcon aria-hidden="true" />
            Books
          </FilterPill>
          <FilterPill>
            <GameIcon aria-hidden="true" />
            Games
          </FilterPill>
        </FilterGroup>
      </Group>
    </>
  )
}
