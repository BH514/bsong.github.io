import { ROSTER, type Chef, type ChefId } from '../chefs/roster.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../chefs/figurine.ts'
import { TAGS } from '../data/tags.ts'
import type { TagId } from '../data/types.ts'
import { renderSvgParts } from './svg.ts'

export interface SelectOptions {
  readonly chefs: readonly [ChefId | null, ChefId | null]
  readonly excluded: readonly TagId[]
  readonly onPickChef: (player: 0 | 1, chef: ChefId) => void
  readonly onToggleTag: (tag: TagId) => void
  readonly onStart: () => void
}

export function renderSelect(options: SelectOptions): HTMLElement {
  const section = document.createElement('section')
  section.className = 'select shell'

  section.append(
    renderHead(),
    renderChips(options),
    renderPicker(0, options),
    renderPicker(1, options),
    renderStart(options),
  )
  return section
}

function renderHead(): HTMLElement {
  const head = document.createElement('div')
  head.className = 'select-head'

  const eyebrow = document.createElement('p')
  eyebrow.className = 'eyebrow'
  eyebrow.textContent = 'Ten ingredients / two cooks / no recipes'

  const title = document.createElement('h1')
  title.append(document.createTextNode('Cooking '))
  const emphasis = document.createElement('span')
  emphasis.textContent = 'Battle'
  title.append(emphasis)

  head.append(eyebrow, title)
  return head
}

function renderChips(options: SelectOptions): HTMLElement {
  const group = document.createElement('div')

  const label = document.createElement('p')
  label.className = 'eyebrow'
  label.id = 'chips-label'
  label.textContent = 'Leave out'

  const chips = document.createElement('div')
  chips.className = 'chips'
  chips.setAttribute('role', 'group')
  chips.setAttribute('aria-labelledby', label.id)

  for (const tag of TAGS) {
    const chip = document.createElement('button')
    chip.className = 'chip'
    chip.type = 'button'
    chip.textContent = tag.label
    chip.setAttribute('aria-pressed', String(options.excluded.includes(tag.id)))
    chip.dataset.focusKey = `chip-${tag.id}`
    chip.addEventListener('click', () => options.onToggleTag(tag.id))
    chips.append(chip)
  }

  group.append(label, chips)
  return group
}

function renderPicker(player: 0 | 1, options: SelectOptions): HTMLElement {
  const picker = document.createElement('div')
  picker.className = 'picker'
  picker.dataset['player'] = String(player + 1)

  const label = document.createElement('p')
  label.className = 'picker-label'
  label.id = `picker-label-${player}`
  label.textContent = player === 0
    ? 'Player one — pick your chef'
    : 'Player two — pick your chef'

  const group = document.createElement('div')
  group.className = 'roster'
  group.setAttribute('role', 'radiogroup')
  group.setAttribute('aria-labelledby', label.id)

  ROSTER.forEach((chef, index) => {
    group.append(renderChefOption(chef, index, player, options))
  })

  picker.append(label, group)
  return picker
}

function renderChefOption(
  chef: Chef,
  index: number,
  player: 0 | 1,
  options: SelectOptions,
): HTMLElement {
  const selected = options.chefs[player] === chef.id
  const unpicked = options.chefs[player] === null

  const option = document.createElement('button')
  option.className = 'chef-option'
  option.type = 'button'
  option.setAttribute('role', 'radio')
  option.setAttribute('aria-checked', String(selected))
  option.tabIndex = selected || (unpicked && index === 0) ? 0 : -1
  option.dataset.focusKey = `chef-${player}-${chef.id}`

  option.append(renderSvgParts(figurineParts(chef, 'knife'), FIGURINE_VIEWBOX))

  const name = document.createElement('span')
  name.className = 'chef-name'
  name.textContent = chef.name
  option.append(name)

  option.addEventListener('click', () => options.onPickChef(player, chef.id))
  option.addEventListener('keydown', (event) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = ROSTER[(index + step + ROSTER.length) % ROSTER.length]
    if (next) options.onPickChef(player, next.id)
  })

  return option
}

function renderStart(options: SelectOptions): HTMLElement {
  const start = document.createElement('button')
  start.className = 'start'
  start.type = 'button'
  start.textContent = 'To the kitchen'
  start.disabled = options.chefs[0] === null || options.chefs[1] === null
  start.dataset.focusKey = 'start'
  start.addEventListener('click', options.onStart)
  return start
}
