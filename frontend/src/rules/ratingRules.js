// The rating rules in docs/data-model.md: whole stars from 1 to 5. The API checks
// the same rule; the star picker only offers ratings it allows.

export const MAX_STARS = 5

/** "1 star" or "4 stars". */
export const starsLabel = (count) => `${count} ${count === 1 ? 'star' : 'stars'}`
