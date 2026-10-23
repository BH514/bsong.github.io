import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ROSTER, CHEF_IDS, chefById } from '../src/chefs/roster.ts'
import { UTENSIL_PARTS } from '../src/chefs/utensils.ts'
import { figurineParts, FIGURINE_VIEWBOX } from '../src/chefs/figurine.ts'
import type { UtensilId } from '../src/data/types.ts'

const UTENSILS: readonly UtensilId[] = [
  'knife', 'cleaver', 'whisk', 'pan', 'wok', 'rolling-pin', 'tongs', 'spoon',
]

test('the roster holds six chefs with unique ids', () => {
  assert.equal(ROSTER.length, 6)
  assert.equal(new Set(ROSTER.map((c) => c.id)).size, 6)
})

test('CHEF_IDS matches the roster order', () => {
  assert.deepEqual(CHEF_IDS, ROSTER.map((c) => c.id))
})

test('no chef id collides with a utensil id', () => {
  for (const id of CHEF_IDS) {
    assert.ok(!(UTENSILS as readonly string[]).includes(id), `${id} collides with a utensil`)
  }
})

test('every chef has a display name and three well-formed colours', () => {
  for (const chef of ROSTER) {
    assert.ok(chef.name.length > 0, `${chef.id} has no name`)
    for (const colour of [chef.skin, chef.coat, chef.accent]) {
      assert.match(colour, /^#[0-9a-f]{6}$/i, `${chef.id} has a malformed colour`)
    }
  }
})

test('chefById finds a chef and returns undefined for a stranger', () => {
  assert.equal(chefById('grill')?.id, 'grill')
  assert.equal(chefById('nobody' as never), undefined)
})

test('all eight utensils have at least one drawable part', () => {
  for (const utensil of UTENSILS) {
    assert.ok(UTENSIL_PARTS[utensil].length > 0, `${utensil} has no parts`)
  }
})

test('figurineParts produces parts for every chef and utensil pairing', () => {
  for (const chef of ROSTER) {
    for (const utensil of UTENSILS) {
      const parts = figurineParts(chef, utensil)
      assert.ok(parts.length >= 6, `${chef.id}/${utensil} produced only ${parts.length} parts`)
    }
  }
})

test('every part names a real SVG shape element', () => {
  const allowed = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'g'])
  for (const chef of ROSTER) {
    for (const part of figurineParts(chef, 'knife')) {
      assert.ok(allowed.has(part.tag), `unexpected tag ${part.tag}`)
    }
  }
})

test('changing only the utensil leaves the body parts identical', () => {
  const chef = ROSTER[0] as (typeof ROSTER)[number]
  const withKnife = figurineParts(chef, 'knife')
  const withWok = figurineParts(chef, 'wok')
  const bodyLength = withKnife.length - UTENSIL_PARTS.knife.length
  assert.deepEqual(withKnife.slice(0, bodyLength), withWok.slice(0, bodyLength))
})

test('the chef colours actually reach the part attributes', () => {
  const chef = ROSTER[0] as (typeof ROSTER)[number]
  const fills = figurineParts(chef, 'knife').map((p) => p.attrs['fill'] ?? '')
  assert.ok(fills.includes(chef.coat), 'the coat colour never appears')
  assert.ok(fills.includes(chef.skin), 'the skin colour never appears')
})

test('the viewBox is a valid four-number string', () => {
  assert.match(FIGURINE_VIEWBOX, /^-?\d+ -?\d+ \d+ \d+$/)
})
