import { useEffect, useRef, useState } from 'react'
import { Heading, Section, Text } from '../components/index.js'
import styles from './Palette.module.css'

const PALETTE = [
  {
    title: 'Canvas',
    colors: [
      ['Night Violet', '--color-night-violet', 'Page background and solid cards'],
      ['Haze', '--color-haze', 'Light at the top of the page'],
      ['Panel top', '--color-panel-top', 'Glass panels, upper edge'],
      ['Panel bottom', '--color-panel-bottom', 'Glass panels, lower edge'],
    ],
  },
  {
    title: 'Cards',
    colors: [
      ['Card top', '--color-card-top', 'Surface cards, upper edge'],
      ['Card bottom', '--color-card-bottom', 'Surface cards, lower edge'],
      ['Card frosted', '--color-card-frosted', 'Frosted card fill'],
      ['Card overlay', '--color-card-overlay', 'Overlay card fill'],
      ['Card border', '--color-border-card', 'Card and panel borders'],
      ['Card glow', '--color-card-glow', 'Soft glow around cards'],
      ['Backdrop', '--color-backdrop', 'Dims the page behind a modal'],
      ['Skeleton', '--color-skeleton', 'Loading placeholder shapes'],
      ['Skeleton shine', '--color-skeleton-shine', 'The light moving across them'],
    ],
  },
  {
    title: 'Text',
    colors: [
      ['Soft Quartz', '--color-soft-quartz', 'Headings and primary content'],
      ['Muted Steel', '--color-muted-steel', 'Secondary emphasis'],
      ['Ash Lilac', '--color-ash-lilac', 'Body copy and navigation'],
      ['Dim Fog', '--color-dim-fog', 'Field underlines, faint text on the page only'],
    ],
  },
  {
    title: 'Accent',
    colors: [
      ['Ultraviolet Core', '--color-ultraviolet-core', 'Fills and glows, never small text'],
      ['Horizon Glow', '--color-horizon-glow', 'Primary button and its glow'],
      ['Lilac Beam', '--color-lilac-beam', 'Focus rings and links'],
    ],
  },
  {
    title: 'Moods (each also has its own icon)',
    colors: [
      ['Hooked', '--color-mood-hooked', 'Couldn’t put it down'],
      ['Delighted', '--color-mood-delighted', 'Pure enjoyment'],
      ['Moved', '--color-mood-moved', 'It stayed with you'],
      ['Curious', '--color-mood-curious', 'Wanting to know more'],
      ['Frustrated', '--color-mood-frustrated', 'Stuck or annoyed'],
      ['Bored', '--color-mood-bored', 'Losing interest'],
    ],
  },
  {
    title: 'Statuses',
    colors: [['Dropped', '--color-status-dropped', 'The Dropped status, in its own rose']],
  },
  {
    title: 'Glow',
    colors: [
      ['Bloom core', '--color-bloom-core', 'Hottest point of the glow'],
      ['Bloom hot', '--color-bloom-hot', 'Just outside the core'],
      ['Bloom magenta', '--color-bloom-magenta', 'The pink-purple band'],
      ['Bloom violet', '--color-bloom-violet', 'Falling away'],
      ['Bloom deep', '--color-bloom-deep', 'Nearly gone'],
      ['Bloom edge', '--color-bloom-edge', 'Where it meets the haze'],
    ],
  },
  {
    title: 'Glass',
    colors: [
      ['Glass 02', '--color-glass-white-02', 'Frosted cards'],
      ['Glass 04', '--color-glass-white-04', 'Faint fills and icon wells'],
      ['Hairline', '--color-hairline', 'Dividers and table rows'],
      ['Glass 10', '--color-glass-white-10', 'Inner highlights'],
      ['Glass 30', '--color-glass-white-30', 'Outline button borders'],
    ],
  },
  {
    title: 'Feedback (messages and data only, never actions)',
    colors: [
      ['Success', '--color-success', 'Positive messages'],
      ['Warning', '--color-warning', 'Cautions'],
      ['Danger', '--color-danger', 'Errors'],
    ],
  },
  {
    title: 'Badges',
    colors: [
      ['Tint accent', '--color-tint-accent', 'Accent badge fill'],
      ['Tint neutral', '--color-tint-neutral', 'Neutral badge fill'],
      ['Tint success', '--color-tint-success', 'Success badge fill'],
      ['Tint warning', '--color-tint-warning', 'Warning badge fill'],
      ['Tint danger', '--color-tint-danger', 'Danger badge fill'],
      ['Border accent', '--color-border-accent', 'Accent badge border'],
      ['Border neutral', '--color-border-neutral', 'Neutral badge border'],
      ['Border success', '--color-border-success', 'Success badge border'],
      ['Border warning', '--color-border-warning', 'Warning badge border'],
      ['Border danger', '--color-border-danger', 'Danger badge border'],
    ],
  },
]

function Swatch({ name, token, use }) {
  const ref = useRef(null)
  const [value, setValue] = useState('')

  // Reads the token from the page, so what's shown can't drift from tokens.css.
  useEffect(() => {
    setValue(getComputedStyle(ref.current).getPropertyValue(token).trim())
  }, [token])

  return (
    <div ref={ref} className={styles.swatch}>
      <div className={styles.color} style={{ background: `var(${token})` }} />
      <Text tone="strong">{name}</Text>
      <Text size="caption">{use}</Text>
      <code className={styles.value}>{value}</code>
      <code className={styles.value}>{token}</code>
    </div>
  )
}

/** The site's colors, grouped by what they're for. */
export function Palette() {
  return (
    <Section>
      <Heading size="medium">Color palette</Heading>
      {PALETTE.map(({ title, colors }) => (
        <div key={title} className={styles.group}>
          <Text size="caption" tone="faint">
            {title}
          </Text>
          <div className={styles.grid}>
            {colors.map(([name, token, use]) => (
              <Swatch key={token} name={name} token={token} use={use} />
            ))}
          </div>
        </div>
      ))}
    </Section>
  )
}
