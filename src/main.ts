import './styles/tokens.css'
import './styles/global.css'
import './styles/select.css'
import './styles/stage.css'

import { renderSelect } from './ui/select.ts'
import { renderStage } from './ui/stage.ts'
import { loadSaved, saveSaved, type Saved } from './storage.ts'
import {
  dealCounter,
  describeDealFailure,
  isFailure,
  type Deal,
  type DealFailure,
} from './deal.ts'
import { createRng, randomSeed } from './rng.ts'
import { filterPantry } from './filters.ts'
import { PANTRY } from './data/pantry.ts'
import { CATEGORIES } from './data/categories.ts'
import type { ChefId } from './chefs/roster.ts'
import type { TagId } from './data/types.ts'

type Screen = 'select' | 'stage'

interface State {
  readonly screen: Screen
  readonly saved: Saved
  readonly deal: Deal | null
  readonly failure: DealFailure | null
  readonly round: number
}

const root = document.querySelector<HTMLElement>('#app')
if (!root) throw new Error('#app is missing from index.html')
const app: HTMLElement = root

const announcer = document.createElement('p')
announcer.className = 'sr-only'
announcer.setAttribute('role', 'status')
announcer.setAttribute('aria-live', 'polite')
document.body.append(announcer)

const initial = loadSaved(window.localStorage)
const bothPicked = initial.chefs[0] !== null && initial.chefs[1] !== null

let state: State = {
  screen: bothPicked ? 'stage' : 'select',
  saved: initial,
  deal: null,
  failure: null,
  round: 0,
}

function setState(next: Partial<State>): void {
  state = { ...state, ...next }
  if (next.saved) saveSaved(window.localStorage, next.saved)
  render()
}

function pantrySize(): number {
  const available = filterPantry(PANTRY, state.saved.excluded)
  return CATEGORIES.reduce((total, category) => total + available[category.id].length, 0)
}

function deal(): void {
  const result = dealCounter(PANTRY, state.saved.excluded, createRng(randomSeed()))
  if (isFailure(result)) {
    announcer.textContent = describeDealFailure(result, state.saved.excluded)
    setState({ failure: result, deal: null })
    return
  }
  setState({ deal: result, failure: null, round: state.round + 1 })
  announcer.textContent =
    `Ten ingredients on the counter: ${result.counter.map((i) => i.name).join(', ')}.`
}

function renderSelectScreen(): void {
  app.replaceChildren(
    renderSelect({
      chefs: state.saved.chefs,
      excluded: state.saved.excluded,
      onPickChef: (player, chef: ChefId) => {
        const chefs: [ChefId | null, ChefId | null] = [state.saved.chefs[0], state.saved.chefs[1]]
        chefs[player] = chef
        setState({ saved: { ...state.saved, chefs } })
      },
      onToggleTag: (tag: TagId) => {
        const excluded = state.saved.excluded.includes(tag)
          ? state.saved.excluded.filter((item) => item !== tag)
          : [...state.saved.excluded, tag]
        setState({ saved: { ...state.saved, excluded }, deal: null, failure: null })
      },
      onStart: () => setState({ screen: 'stage' }),
    }),
  )
}

function renderStageScreen(first: ChefId, second: ChefId): void {
  app.replaceChildren(
    renderStage({
      chefs: [first, second],
      deal: state.deal,
      failure: state.failure,
      excluded: state.saved.excluded,
      round: state.round,
      pantrySize: pantrySize(),
      onDeal: deal,
      onChangeChef: () => setState({ screen: 'select' }),
    }),
  )
}

function render(): void {
  const active = document.activeElement
  const focusKey = active instanceof HTMLElement ? active.dataset['focusKey'] : undefined

  if (state.screen === 'select') {
    renderSelectScreen()
  } else {
    const [first, second] = state.saved.chefs
    if (first === null || second === null) {
      setState({ screen: 'select' })
      return
    }
    renderStageScreen(first, second)
  }

  restoreFocus(focusKey)
}

/**
 * Same-screen re-render restores the control; a screen change cannot, because
 * the control no longer exists, so focus goes to #app (which carries
 * tabindex="-1" for exactly this). An absent key is the test for the two.
 */
function restoreFocus(focusKey: string | undefined): void {
  if (focusKey === undefined) return

  // Arrow keys move the selection, so the option that had focus is not the one
  // that should receive it back — the newly checked radio is.
  const chefMatch = focusKey.match(/^chef-(\d+)-/)
  if (chefMatch && chefMatch[1]) {
    const player = Number(chefMatch[1])
    const selected = state.saved.chefs[player]
    if (selected) {
      app.querySelector<HTMLElement>(`[data-focus-key="chef-${player}-${selected}"]`)?.focus()
      return
    }
  }

  const target = app.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`)
  if (target) {
    target.focus()
    return
  }
  app.focus()
}

render()
