import { describeDealFailure, type Deal, type DealFailure, type Hand } from '../deal.ts'
import { chefById, type ChefId } from '../chefs/roster.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../chefs/figurine.ts'
import { CATEGORIES, CATEGORY_LABELS, TAG_LABELS } from '../data/categories.ts'
import { SHELF } from '../data/pantry.ts'
import { excludeTags } from '../filters.ts'
import type { Ingredient, TagId } from '../data/types.ts'
import { renderSvgParts } from './svg.ts'

/** Spec §11: counter tiles pop in on a 40 ms stagger, slot pips fill in turn. */
const TILE_STAGGER_MS = 40
const PIP_STAGGER_MS = 70

export interface StageOptions {
  readonly chefs: readonly [ChefId, ChefId]
  readonly deal: Deal | null
  readonly failure: DealFailure | null
  readonly excluded: readonly TagId[]
  readonly round: number
  readonly pantrySize: number
  readonly onDeal: () => void
  readonly onChangeChef: (player: 0 | 1) => void
}

export function renderStage(options: StageOptions): HTMLElement {
  const section = document.createElement('section')
  section.className = 'stage shell'
  // The figurines' entrance belongs to arriving on the stage, not to every
  // deal: re-flying them in from off-stage would hide the new utensil and
  // turn a mid-cooking utility into a title sequence.
  if (options.round === 0) section.dataset['entrance'] = 'on'

  const board = document.createElement('div')
  board.className = 'board'
  board.append(
    renderFigurine(0, options),
    renderPanel(0, options),
    renderVs(),
    renderPanel(1, options),
    renderFigurine(1, options),
  )

  section.append(renderHud(options), board, renderCounter(options))
  return section
}

function renderHud(options: StageOptions): HTMLElement {
  const hud = document.createElement('header')
  hud.className = 'st-hud'

  const meta = document.createElement('span')
  const round = document.createElement('b')
  round.textContent = String(options.round).padStart(2, '0')
  const pantry = document.createElement('b')
  pantry.textContent = String(options.pantrySize)
  meta.append('Round ', round, ' / Pantry ', pantry)
  if (options.excluded.length > 0) {
    const labels = options.excluded.map((tag) => TAG_LABELS.get(tag) ?? tag)
    meta.append(` / Without ${labels.join(', ')}`)
  }

  const logo = document.createElement('h1')
  logo.className = 'st-logo'
  logo.textContent = 'Cooking Battle'

  const deal = document.createElement('button')
  deal.className = 'deal'
  deal.type = 'button'
  deal.textContent = 'Deal'
  deal.disabled = options.failure !== null
  // The primary control, pressed repeatedly: it must survive its own re-render.
  deal.dataset.focusKey = 'deal'
  deal.addEventListener('click', options.onDeal)

  hud.append(meta, logo, deal)
  return hud
}

function renderFigurine(player: 0 | 1, options: StageOptions): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'figurine'
  wrapper.dataset['player'] = String(player + 1)

  const chef = chefById(options.chefs[player])
  if (!chef) return wrapper

  const utensil = options.deal?.hands[player].utensil ?? 'knife'
  const button = document.createElement('button')
  button.type = 'button'
  button.setAttribute('aria-label', `${chef.name} — change chef`)
  // Pressing this changes screen, so the key deliberately finds no match
  // afterwards and focus lands on #app rather than on a control that is gone.
  button.dataset.focusKey = `figurine-${player}`
  button.append(renderSvgParts(figurineParts(chef, utensil), FIGURINE_VIEWBOX))

  const name = document.createElement('span')
  name.className = 'figurine-name'
  name.textContent = chef.name
  button.append(name)
  button.addEventListener('click', () => options.onChangeChef(player))

  wrapper.append(button)
  return wrapper
}

function renderPanel(player: 0 | 1, options: StageOptions): HTMLElement {
  const panel = document.createElement('div')
  panel.className = 'pan'
  panel.dataset['player'] = String(player + 1)

  const name = document.createElement('h2')
  name.className = 'pan-name'
  name.textContent = player === 0 ? 'Player One' : 'Player Two'
  panel.append(name)

  const hand: Hand | undefined = options.deal?.hands[player]

  const pips = document.createElement('div')
  pips.className = 'pips'
  const filled = hand ? hand.slots.length : 0
  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const pip = document.createElement('i')
    if (index < filled) {
      // CSS owns the filled/unfilled contrast so it survives reduced motion;
      // the delay only sequences the fill.
      pip.dataset['filled'] = 'true'
      pip.style.animationDelay = `${index * PIP_STAGGER_MS}ms`
    }
    pips.append(pip)
  }
  panel.append(pips)

  if (!hand) {
    const waiting = document.createElement('p')
    waiting.className = 'slot-category'
    waiting.textContent = 'Press deal to start'
    panel.append(waiting)
    return panel
  }

  for (const ingredient of hand.slots) {
    panel.append(renderSlot(ingredient))
  }
  return panel
}

function renderSlot(ingredient: Ingredient): HTMLElement {
  const slot = document.createElement('div')
  slot.className = 'slot'

  const icon = document.createElement('span')
  icon.className = 'slot-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = ingredient.icon

  const text = document.createElement('span')
  const name = document.createElement('span')
  name.className = 'slot-name'
  name.textContent = ingredient.name
  const category = document.createElement('span')
  category.className = 'slot-category'
  category.textContent = CATEGORY_LABELS.get(ingredient.category) ?? ingredient.category
  text.append(name, category)

  slot.append(icon, text)
  return slot
}

function renderVs(): HTMLElement {
  const vs = document.createElement('div')
  vs.className = 'vs'
  vs.setAttribute('aria-hidden', 'true')
  vs.textContent = 'VS'
  return vs
}

function renderCounter(options: StageOptions): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'st-counter'

  const heading = document.createElement('h2')
  heading.className = 'eyebrow'
  heading.textContent = 'The counter — all ten, both cooks'
  wrapper.append(heading)

  const tiles = document.createElement('div')
  tiles.className = 'ctiles'
  options.deal?.counter.forEach((ingredient, index) => {
    const tile = document.createElement('span')
    tile.className = 'ctile'
    tile.style.animationDelay = `${index * TILE_STAGGER_MS}ms`

    const name = document.createElement('span')
    name.className = 'ctile-name'
    name.textContent = ingredient.name
    // Colour is never the only carrier of meaning: spec §10 wants the category
    // in text on every ingredient, counter tiles included.
    const category = document.createElement('span')
    category.className = 'ctile-category'
    category.textContent = CATEGORY_LABELS.get(ingredient.category) ?? ingredient.category

    tile.append(name, category)
    tiles.append(tile)
  })
  wrapper.append(tiles)

  const shelf = document.createElement('p')
  shelf.className = 'shelf'
  const staples = excludeTags(SHELF, options.excluded).map((item) => item.name)
  shelf.textContent = `Shelf, free and unlimited — ${staples.join(' / ')}`
  wrapper.append(shelf)

  if (options.failure) {
    const error = document.createElement('p')
    error.className = 'deal-error'
    error.setAttribute('role', 'alert')
    error.textContent = describeDealFailure(options.failure, options.excluded)
    wrapper.append(error)
  }

  return wrapper
}
