import type { CategoryId, Ingredient } from './types.ts'
import { PROTEINS } from './proteins.ts'
import { VEGETABLES } from './vegetables.ts'
import { STARCHES } from './starches.ts'
import { AROMATICS } from './aromatics.ts'
import { WILDCARDS } from './wildcards.ts'
import { SHELF } from './shelf.ts'

export const PANTRY: Readonly<Record<CategoryId, readonly Ingredient[]>> = {
  protein: PROTEINS,
  vegetable: VEGETABLES,
  starch: STARCHES,
  aromatic: AROMATICS,
  wildcard: WILDCARDS,
}

export const ALL_INGREDIENTS: readonly Ingredient[] = [
  ...PROTEINS, ...VEGETABLES, ...STARCHES, ...AROMATICS, ...WILDCARDS,
]

export { SHELF }
