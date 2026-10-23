import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRng, shuffle, randomSeed } from '../src/rng.ts'

test('the same seed produces the same sequence', () => {
  const a = createRng(42)
  const b = createRng(42)
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})

test('different seeds produce different sequences', () => {
  assert.notEqual(createRng(1)(), createRng(2)())
})

test('generated values stay in the unit interval', () => {
  const rng = createRng(7)
  for (let i = 0; i < 200; i += 1) {
    const value = rng()
    assert.ok(value >= 0 && value < 1, `out of range: ${value}`)
  }
})

test('shuffle returns a new array and leaves the input untouched', () => {
  const input = Object.freeze(['a', 'b', 'c', 'd'])
  const result = shuffle(input, createRng(3))
  assert.notEqual(result, input)
  assert.deepEqual([...input], ['a', 'b', 'c', 'd'])
  assert.deepEqual([...result].sort(), ['a', 'b', 'c', 'd'])
})

test('shuffle is deterministic for a given seed', () => {
  const input = ['a', 'b', 'c', 'd', 'e', 'f']
  assert.deepEqual(shuffle(input, createRng(9)), shuffle(input, createRng(9)))
})

test('randomSeed returns a non-negative integer', () => {
  const seed = randomSeed()
  assert.ok(Number.isInteger(seed) && seed >= 0)
})
