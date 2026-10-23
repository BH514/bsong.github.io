import type { CategoryId, Ingredient, TagId, UtensilId } from './data/types.ts'
import { CATEGORIES } from './data/categories.ts'
import { filterPantry, type Pantry } from './filters.ts'
import { shuffle, type Rng } from './rng.ts'

export interface Hand {
  readonly slots: readonly Ingredient[]
  readonly utensil: UtensilId
}

export interface Deal {
  readonly hands: readonly [Hand, Hand]
  readonly counter: readonly Ingredient[]
}

export interface DealFailure {
  readonly kind: 'insufficient-pool'
  readonly category: CategoryId
  readonly remaining: number
}

export type DealResult = Deal | DealFailure

export function isFailure(result: DealResult): result is DealFailure {
  return 'kind' in result
}

const FALLBACK_UTENSIL: UtensilId = 'knife'
const PLAYERS_PER_GAME = 2

/**
 * Draws two distinct ingredients per category and gives one to each player.
 * Making distinctness and balance the same operation means neither can fail
 * independently of the other.
 */
export function dealCounter(
  pantry: Pantry,
  excluded: readonly TagId[],
  rng: Rng,
): DealResult {
  const available = filterPantry(pantry, excluded)

  for (const category of CATEGORIES) {
    const remaining = available[category.id].length
    if (remaining < PLAYERS_PER_GAME) {
      return { kind: 'insufficient-pool', category: category.id, remaining }
    }
  }

  const first: Ingredient[] = []
  const second: Ingredient[] = []
  for (const category of CATEGORIES) {
    const drawn = shuffle(available[category.id], rng)
    first.push(drawn[0] as Ingredient)
    second.push(drawn[1] as Ingredient)
  }

  const hands: readonly [Hand, Hand] = [toHand(first), toHand(second)]
  return { hands, counter: [...hands[0].slots, ...hands[1].slots] }
}

function toHand(slots: readonly Ingredient[]): Hand {
  const starch = slots.find((slot) => slot.category === 'starch')
  return { slots, utensil: starch?.utensil ?? FALLBACK_UTENSIL }
}
