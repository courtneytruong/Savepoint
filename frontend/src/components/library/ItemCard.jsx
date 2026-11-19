import styles from './ItemCard.module.css'
import { MoodBadge } from '../reflections/Mood.jsx'
import { StatusBadge } from './StatusBadge.jsx'
import { classNames } from '../../utils/classNames.js'
import { BookIcon, GameIcon } from '../icons.js'
import { Stars } from './StarRating.jsx'
import { Link } from '../ui/Link.jsx'

// Keyed by the medium values in docs/data-model.md.
const MEDIA = {
  Book: { label: 'Book', Icon: BookIcon },
  Game: { label: 'Game', Icon: GameIcon },
}

/** A book or game's type, with its icon. */
export function MediumLabel({ medium }) {
  const { label, Icon } = MEDIA[medium]

  return (
    <span className={styles.medium}>
      <Icon aria-hidden="true" />
      {label}
    </span>
  )
}

/** A rating from 1 to 5, shown as stars. */
export function Rating({ value }) {
  return <Stars value={value} className={styles.rating} />
}

/** Lays out item cards, fitting as many columns as the space allows. */
export function ItemGrid({ className, ...props }) {
  return <ul className={classNames(styles.grid, className)} {...props} />
}

/**
 * A book or game in the grid view. Goes inside an ItemGrid. The title is a link
 * that covers the whole card, so anywhere on it opens the item.
 */
export function ItemCard({ title, creator, medium, status, mood, rating, excerpt, href, headingAs: Title = 'h3' }) {
  const { Icon } = MEDIA[medium]

  return (
    <li className={styles.card}>
      <div className={styles.top}>
        <span className={styles.well} aria-hidden="true">
          <Icon />
        </span>
        <MediumLabel medium={medium} />
        {/* The API sends null for an item that isn't rated yet. */}
        {rating != null && <Rating value={rating} />}
      </div>
      <div>
        <Title className={styles.title}>
          <Link href={href} className={styles.link}>
            {title}
          </Link>
        </Title>
        {creator && <p className={styles.creator}>{creator}</p>}
      </div>
      {excerpt && <p className={styles.excerpt}>{excerpt}</p>}
      <div className={styles.badges}>
        <StatusBadge status={status} />
        {mood && <MoodBadge mood={mood} />}
      </div>
    </li>
  )
}
