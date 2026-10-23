import type { TagId } from './data/types.ts'
import { ALL_TAG_IDS } from './data/categories.ts'
import { CHEF_IDS, type ChefId } from './chefs/roster.ts'

const KEY = 'cooking-battle:v1'

export interface Saved {
  readonly chefs: readonly [ChefId | null, ChefId | null]
  readonly excluded: readonly TagId[]
}

/** The slice of the Storage API we use, so tests need no browser. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const DEFAULTS: Saved = { chefs: [null, null], excluded: [] }

function asChefId(value: unknown): ChefId | null {
  return typeof value === 'string' && (CHEF_IDS as readonly string[]).includes(value)
    ? (value as ChefId)
    : null
}

/** Never trusts what it reads — stored ids may be stale or hand-edited. */
export function parseSaved(raw: string | null): Saved {
  if (raw === null) return DEFAULTS

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return DEFAULTS
  }
  if (typeof payload !== 'object' || payload === null) return DEFAULTS

  const record = payload as Record<string, unknown>
  const rawChefs = Array.isArray(record['chefs']) ? record['chefs'] : []
  const rawExcluded = Array.isArray(record['excluded']) ? record['excluded'] : []

  return {
    chefs: [asChefId(rawChefs[0]), asChefId(rawChefs[1])],
    excluded: rawExcluded.filter(
      (tag): tag is TagId =>
        typeof tag === 'string' && (ALL_TAG_IDS as readonly string[]).includes(tag),
    ),
  }
}

export function serialiseSaved(saved: Saved): string {
  return JSON.stringify({ chefs: saved.chefs, excluded: saved.excluded })
}

/** Private browsing and blocked storage must degrade, not crash. */
export function loadSaved(store: StorageLike): Saved {
  try {
    return parseSaved(store.getItem(KEY))
  } catch {
    return DEFAULTS
  }
}

export function saveSaved(store: StorageLike, saved: Saved): void {
  try {
    store.setItem(KEY, serialiseSaved(saved))
  } catch {
    // Storage being unavailable is not worth interrupting a game over.
  }
}
