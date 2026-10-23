import type { CategoryId, Ingredient, TagId, UtensilId } from './data/types.ts'
import { CATEGORIES, CATEGORY_LABELS, TAG_LABELS } from './data/categories.ts'
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

/**
 * The single source of the over-filtering sentence. The live region and the
 * on-screen panel must read identically, so neither may build it themselves.
 */
export function describeDealFailure(
  failure: DealFailure,
  excluded: readonly TagId[],
): string {
  const category = CATEGORY_LABELS.get(failure.category) ?? failure.category
  const shortfall = `${category} has only ${failure.remaining} ingredient(s) left.`
  if (excluded.length === 0) return shortfall

  const chips = excluded.map((tag) => TAG_LABELS.get(tag) ?? tag).join(', ')
  return `${shortfall} Turn one of these back on: ${chips}.`
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
  return { hands, counter: mergeCounter(hands) }
}

/**
 * Category-major, player-minor: each category's two ingredients sit side by
 * side, which is the whole point of a shared counter. Both hands already run
 * in CATEGORIES order, so interleaving by index is enough.
 */
function mergeCounter(hands: readonly [Hand, Hand]): readonly Ingredient[] {
  return hands[0].slots.flatMap((slot, index) => {
    const opposite = hands[1].slots[index]
    return opposite === undefined ? [slot] : [slot, opposite]
  })
}

function toHand(slots: readonly Ingredient[]): Hand {
  const starch = slots.find((slot) => slot.category === 'starch')
  return { slots, utensil: starch?.utensil ?? FALLBACK_UTENSIL }
}
