import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATEGORIES, TAGS, ALL_TAG_IDS } from '../src/data/categories.ts'
import { PANTRY, SHELF, ALL_INGREDIENTS } from '../src/data/pantry.ts'

test('there are exactly five categories in slot order', () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.id),
    ['protein', 'vegetable', 'starch', 'aromatic', 'wildcard'],
  )
})

test('every category holds at least thirty ingredients', () => {
  for (const category of CATEGORIES) {
    const pool = PANTRY[category.id]
    assert.ok(pool.length >= 30, `${category.id} has only ${pool.length}`)
  }
})

test('ingredient ids are unique across the whole pantry', () => {
  const ids = ALL_INGREDIENTS.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('every ingredient sits in the category pool it declares', () => {
  for (const category of CATEGORIES) {
    for (const ingredient of PANTRY[category.id]) {
      assert.equal(ingredient.category, category.id, `${ingredient.id} is misfiled`)
    }
  }
})

test('every ingredient has a name and an icon', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    assert.ok(ingredient.name.length > 0, `${ingredient.id} has no name`)
    assert.ok(ingredient.icon.length > 0, `${ingredient.id} has no icon`)
  }
})

test('every ingredient uses only known tags', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    for (const tag of ingredient.tags) {
      assert.ok(ALL_TAG_IDS.includes(tag), `${ingredient.id} has unknown tag ${tag}`)
    }
  }
})

test('anything tagged meat or dairy is also tagged animal', () => {
  for (const ingredient of [...ALL_INGREDIENTS, ...SHELF]) {
    if (ingredient.tags.includes('meat') || ingredient.tags.includes('dairy')) {
      assert.ok(ingredient.tags.includes('animal'), `${ingredient.id} is missing the animal tag`)
    }
  }
})

test('every starch declares a utensil and nothing else does', () => {
  for (const ingredient of PANTRY.starch) {
    assert.ok(ingredient.utensil, `${ingredient.id} has no utensil`)
  }
  const others = CATEGORIES.filter((c) => c.id !== 'starch').flatMap((c) => PANTRY[c.id])
  for (const ingredient of others) {
    assert.equal(ingredient.utensil, undefined, `${ingredient.id} should not declare a utensil`)
  }
})

test('all eight utensils are reachable from the starch pool', () => {
  const used = new Set(PANTRY.starch.map((i) => i.utensil))
  assert.deepEqual(
    [...used].sort(),
    ['cleaver', 'knife', 'pan', 'rolling-pin', 'spoon', 'tongs', 'whisk', 'wok'],
  )
})

test('every category still has two candidates with every tag excluded', () => {
  for (const category of CATEGORIES) {
    const survivors = PANTRY[category.id].filter((i) => i.tags.length === 0)
    assert.ok(survivors.length >= 2, `${category.id} would only leave ${survivors.length}`)
  }
})

test('each tag is used by at least one ingredient', () => {
  for (const tag of TAGS) {
    assert.ok(
      ALL_INGREDIENTS.some((i) => i.tags.includes(tag.id)),
      `tag ${tag.id} is never used`,
    )
  }
})
