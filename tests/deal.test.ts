import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dealCounter, isFailure } from '../src/deal.ts'
import { PANTRY } from '../src/data/pantry.ts'
import { CATEGORIES, ALL_TAG_IDS } from '../src/data/categories.ts'
import { createRng } from '../src/rng.ts'
import type { Ingredient, TagId } from '../src/data/types.ts'

function dealOrThrow(excluded: readonly TagId[] = [], seed = 1) {
  const result = dealCounter(PANTRY, excluded, createRng(seed))
  assert.ok(!isFailure(result), 'expected a successful deal')
  return result
}

test('each hand holds exactly one ingredient per category, in slot order', () => {
  const deal = dealOrThrow()
  for (const hand of deal.hands) {
    assert.deepEqual(hand.slots.map((s) => s.category), CATEGORIES.map((c) => c.id))
  }
})

test('all ten dealt ingredients are distinct', () => {
  for (let seed = 0; seed < 50; seed += 1) {
    const ids = dealOrThrow([], seed).counter.map((i) => i.id)
    assert.equal(new Set(ids).size, 10, `seed ${seed} dealt a duplicate`)
  }
})

test('the counter holds exactly two ingredients per category', () => {
  const deal = dealOrThrow()
  assert.equal(deal.counter.length, 10)
  for (const category of CATEGORIES) {
    const count = deal.counter.filter((i) => i.category === category.id).length
    assert.equal(count, 2, `${category.id} appeared ${count} times`)
  }
})

test('the counter is exactly both hands combined', () => {
  const deal = dealOrThrow()
  const fromHands = [...deal.hands[0].slots, ...deal.hands[1].slots].map((i) => i.id).sort()
  assert.deepEqual([...deal.counter].map((i) => i.id).sort(), fromHands)
})

test('excluded tags never appear in a deal', () => {
  for (let seed = 0; seed < 25; seed += 1) {
    for (const ingredient of dealOrThrow(['nuts', 'meat'], seed).counter) {
      assert.ok(!ingredient.tags.includes('nuts'), `${ingredient.id} leaked nuts`)
      assert.ok(!ingredient.tags.includes('meat'), `${ingredient.id} leaked meat`)
    }
  }
})

test('dealing still succeeds with every tag excluded', () => {
  const result = dealCounter(PANTRY, ALL_TAG_IDS, createRng(5))
  assert.ok(!isFailure(result), 'the shipped pantry must survive every exclusion')
})

test('a fixed seed reproduces an identical deal', () => {
  assert.deepEqual(
    dealOrThrow([], 1234).counter.map((i) => i.id),
    dealOrThrow([], 1234).counter.map((i) => i.id),
  )
})

test('different seeds generally produce different deals', () => {
  assert.notEqual(
    dealOrThrow([], 1).counter.map((i) => i.id).join(),
    dealOrThrow([], 2).counter.map((i) => i.id).join(),
  )
})

test('a hand takes its utensil from its starch', () => {
  for (const hand of dealOrThrow().hands) {
    const starch = hand.slots.find((s) => s.category === 'starch')
    assert.ok(starch)
    assert.equal(hand.utensil, starch.utensil)
  }
})

test('a starch with no utensil falls back to the knife', () => {
  const stub: Ingredient = { id: 'x', name: 'X', category: 'starch', icon: '?', tags: [] }
  const pantry = { ...PANTRY, starch: [stub, { ...stub, id: 'y' }] }
  const result = dealCounter(pantry, [], createRng(1))
  assert.ok(!isFailure(result))
  assert.equal(result.hands[0].utensil, 'knife')
})

test('a category with fewer than two candidates returns a typed failure', () => {
  const only: Ingredient = { id: 'solo', name: 'Solo', category: 'vegetable', icon: '?', tags: [] }
  const result = dealCounter({ ...PANTRY, vegetable: [only] }, [], createRng(1))
  assert.ok(isFailure(result))
  assert.equal(result.kind, 'insufficient-pool')
  assert.equal(result.category, 'vegetable')
  assert.equal(result.remaining, 1)
})

test('an empty category also fails rather than throwing', () => {
  const result = dealCounter({ ...PANTRY, aromatic: [] }, [], createRng(1))
  assert.ok(isFailure(result))
  assert.equal(result.category, 'aromatic')
  assert.equal(result.remaining, 0)
})

test('dealing does not mutate the pantry', () => {
  const before = CATEGORIES.map((c) => PANTRY[c.id].length)
  dealOrThrow()
  assert.deepEqual(CATEGORIES.map((c) => PANTRY[c.id].length), before)
})
