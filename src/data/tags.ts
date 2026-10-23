import type { Tag } from './types.ts'

/** Phrased as exclusions: vegetarian excludes `meat`, vegan excludes `animal`. */
export const TAGS: readonly Tag[] = [
  { id: 'meat', label: 'Meat & fish' },
  { id: 'animal', label: 'Animal products' },
  { id: 'pork', label: 'Pork' },
  { id: 'shellfish', label: 'Shellfish' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'nuts', label: 'Nuts & seeds' },
  { id: 'spicy', label: 'Spicy' },
]
