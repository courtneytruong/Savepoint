import { Button, GlowFrame, Heading, Hero, ItemCard, ItemGrid, Text } from '../components/index.js'
import { CREATE_ACCOUNT_PATH, SIGN_IN_PATH } from '../paths.js'
import styles from './LandingPage.module.css'

// A glimpse of a library, to show what Savepoint looks like once you're using it.
const PREVIEW_ITEMS = [
  {
    title: 'The Left Hand of Darkness',
    creator: 'Ursula K. Le Guin',
    medium: 'Book',
    status: 'Finished',
    mood: 'Moved',
    rating: 9,
    excerpt: 'The crossing of the ice stayed with me long after the last page.',
  },
  {
    title: 'Hades',
    creator: 'Supergiant Games',
    medium: 'Game',
    status: 'InProgress',
    mood: 'Hooked',
    rating: 10,
    excerpt: 'One more run turned into three. Every failure still moves the story along.',
  },
  {
    title: 'Piranesi',
    creator: 'Susanna Clarke',
    medium: 'Book',
    status: 'Finished',
    mood: 'Curious',
    rating: 8,
    excerpt: 'I had no idea what was going on at first, and that turned out to be the point.',
  },
  {
    title: 'Outer Wilds',
    creator: 'Mobius Digital',
    medium: 'Game',
    status: 'Finished',
    mood: 'Moved',
    rating: 10,
    excerpt: 'I wish I could forget it and start again.',
  },
]

/**
 * Home for someone signed out: what Savepoint is, and the way in, whether they
 * have an account yet or not. The sign-in pages link back here through the brand.
 *
 * Under the intro, as in the /components gallery, is a glowing panel: here a
 * preview of a library. It's only a picture, so it's inert: its cards can't be
 * focused or followed, and screen readers pass over it.
 */
export function LandingPage() {
  return (
    <main className={styles.page}>
      <p className={styles.brand}>Savepoint</p>

      <Hero
        panel={
          <GlowFrame inert className={styles.preview}>
            <ItemGrid>
              {PREVIEW_ITEMS.map((item) => (
                <ItemCard key={item.title} {...item} href="#" />
              ))}
            </ItemGrid>
          </GlowFrame>
        }
      >
        <Heading as="h1" size="display">
          Every thought, in order
        </Heading>
        <Text size="subheading" className={styles.lead}>
          A journal for the books you read and the games you play, and how your thinking changes along the way.
        </Text>
        <div className={styles.actions}>
          <Button href={SIGN_IN_PATH}>Sign in</Button>
          <Button href={CREATE_ACCOUNT_PATH}>Create an account</Button>
        </div>
      </Hero>
    </main>
  )
}
