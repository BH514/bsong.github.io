import { shelfRows } from './row.ts'

/**
 * Always available to both players and never counted in the ten — but still
 * filtered, because butter is dairy and flour is gluten.
 */
export const SHELF = shelfRows([
  ['shelf-oil', 'Oil', '🫗', []],
  ['shelf-salt', 'Salt', '🧂', []],
  ['shelf-pepper', 'Black pepper', '⚫', []],
  ['shelf-sugar', 'Sugar', '🍬', []],
  ['shelf-vinegar', 'Vinegar', '🧴', []],
  ['shelf-water', 'Water', '💧', []],
  ['shelf-butter', 'Butter', '🧈', ['dairy', 'animal']],
  ['shelf-flour', 'Plain flour', '🌾', ['gluten']],
  ['shelf-eggs', 'Eggs', '🥚', ['animal']],
])
