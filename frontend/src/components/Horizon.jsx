import styles from './Horizon.module.css'

const WIDTH = 1600
const HEIGHT = 560
const CENTRE_X = WIDTH / 2

// Rays fan out from the middle of the horizon. They start part way out, so they
// don't all pile into one bright point.
const RAYS = Array.from({ length: 13 }, (_, index) => {
  const angle = ((index - 6) * 13 * Math.PI) / 180
  return {
    x1: CENTRE_X + Math.sin(angle) * 140,
    y1: HEIGHT - Math.cos(angle) * 140,
    x2: CENTRE_X + Math.sin(angle) * 1500,
    y2: HEIGHT - Math.cos(angle) * 1500,
  }
})

const RINGS = [
  [320, 110],
  [520, 180],
  [740, 260],
  [1000, 350],
  [1300, 470],
]

// A fixed sequence rather than Math.random, so the specks of light stay in the
// same places on every render.
const SPECKS = Array.from({ length: 44 }, (_, index) => ({
  cx: (index * 397 + 83) % WIDTH,
  cy: (index * 211 + 37) % (HEIGHT - 120),
  r: index % 5 === 0 ? 1.4 : 0.9,
  opacity: 0.25 + ((index * 7) % 10) / 20,
}))

/** The light behind a panel: a glow on the horizon, fine lines and specks of light. */
export function Horizon() {
  return (
    <div className={styles.horizon} aria-hidden="true">
      <svg className={styles.art} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMax slice">
        <g className={styles.lines}>
          {RAYS.map((ray) => (
            <line key={ray.x2} {...ray} />
          ))}
          {RINGS.map(([rx, ry]) => (
            <ellipse key={rx} cx={CENTRE_X} cy={HEIGHT} rx={rx} ry={ry} />
          ))}
        </g>
        {SPECKS.map((speck) => (
          <circle key={speck.cx} className={styles.speck} {...speck} />
        ))}
      </svg>
      <div className={styles.bloom} />
    </div>
  )
}
