import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createBatch,
  createHistory,
  createSeededRandom,
  distribution,
  generateRun,
  parseSeed,
  recordRun,
  sampleIndex,
} from '../src/model.ts';
import { SCENARIOS } from '../src/scenarios.ts';

const robot = SCENARIOS[0];
assert.ok(robot);
const weights = [
  { id: 'a', text: 'A', label: 'A', weight: 55 },
  { id: 'b', text: 'B', label: 'B', weight: 30 },
  { id: 'c', text: 'C', label: 'C', weight: 15 },
];

test('temperature 1 preserves the hand-authored 55/30/15 probabilities', () => {
  const actual = distribution(weights, 1).map((entry) => entry.probability);
  for (const [index, expected] of [0.55, 0.3, 0.15].entries()) {
    assert.ok(Math.abs(actual[index]! - expected) < 1e-12);
  }
});

test('cooling sharpens and warming flattens the same normalized distribution', () => {
  const cold = distribution(weights, 0.5);
  const warm = distribution(weights, 2);
  assert.ok(Math.abs(cold[0]!.probability - 121 / 166) < 1e-12);
  assert.ok(warm[0]!.probability > 0.44 && warm[0]!.probability < 0.45);
  assert.ok(warm[2]!.probability > 0.23 && warm[2]!.probability < 0.24);
  for (const temperature of [0.2, 0.5, 1, 1.5, 2]) {
    const sum = distribution(weights, temperature)
      .reduce((total, entry) => total + entry.probability, 0);
    assert.ok(Math.abs(sum - 1) < 1e-12);
  }
});

test('zero-weight choices stay impossible and large weights remain finite', () => {
  const entries = distribution([
    { ...weights[0]!, weight: 0 },
    { ...weights[1]!, weight: 1e308 },
  ], 0.2);
  assert.deepEqual(entries.map((entry) => entry.probability), [0, 1]);
});

test('invalid probability inputs fail explicitly instead of producing misleading odds', () => {
  for (const temperature of [0, -1, 0.19, 2.01, NaN, Infinity]) {
    assert.throws(() => distribution(weights, temperature), RangeError);
  }
  assert.throws(() => distribution([], 1), RangeError);
  for (const weight of [-1, NaN, Infinity, 0]) {
    assert.throws(() => distribution([{ ...weights[0]!, weight }], 1), RangeError);
  }
});

test('weighted draws respect interval boundaries and never select zero probability', () => {
  for (const [draw, expected] of [[0, 0], [0.549, 0], [0.55, 1], [0.849, 1], [0.851, 2], [0.999999, 2]]) {
    assert.equal(sampleIndex([0.55, 0.3, 0.15], draw!), expected);
  }
  assert.equal(sampleIndex([0.5, 0.25, 0.25], 0.5), 1);
  assert.equal(sampleIndex([0.5, 0.25, 0.25], 0.75), 2);
  assert.equal(sampleIndex([0, 1, 0], 0), 1);
  assert.equal(sampleIndex([0, 1, 0], 0.9999999999999999), 1);
  for (const draw of [-0.1, 1, NaN, Infinity]) {
    assert.throws(() => sampleIndex([0.5, 0.5], draw), RangeError);
  }
  for (const probabilities of [[], [0, 0], [-1, 2], [0.2, 0.2], [NaN, 1]]) {
    assert.throws(() => sampleIndex(probabilities, 0.5), RangeError);
  }
});

test('a seed replays the random sequence without making every draw identical', () => {
  const first = createSeededRandom(42);
  const second = createSeededRandom(42);
  const different = createSeededRandom(43);
  const draws = Array.from({ length: 100 }, () => first());
  assert.deepEqual(draws, Array.from({ length: 100 }, () => second()));
  assert.notDeepEqual(draws, Array.from({ length: 100 }, () => different()));
  assert.ok(draws.every((draw) => draw >= 0 && draw < 1));
  assert.ok(new Set(draws).size > 90);
});

test('seed parsing accepts the full unsigned 32-bit range and rejects invalid input', () => {
  assert.equal(parseSeed('0'), 0);
  assert.equal(parseSeed(' 42 '), 42);
  assert.equal(parseSeed('4294967295'), 4294967295);
  for (const value of ['', ' ', '-1', '1.5', '4294967296', 'hello', 'Infinity', '1e2']) {
    assert.throws(() => parseSeed(value), RangeError);
  }
  for (const value of [-1, 1.2, 4294967296, NaN]) {
    assert.throws(() => createSeededRandom(value), RangeError);
  }
});

test('explicit rules do not consult randomness or follow the highest probability', () => {
  const forbiddenRandom = () => { throw new Error('Rules must not draw randomness'); };
  const first = generateRun(robot, 'rules', 0.2, forbiddenRandom);
  const second = generateRun(robot, 'rules', 2, forbiddenRandom);
  assert.equal(first.text, 'The tiny robot discovered a hidden key beneath the city.');
  assert.equal(second.text, first.text);
  assert.deepEqual(first.steps.map((step) => step.selected.id), ['hidden', 'key', 'city']);
});

test('greedy selection is repeatable and exposes the probabilities for its actual context', () => {
  const forbiddenRandom = () => { throw new Error('Greedy must not draw randomness'); };
  const run = generateRun(robot, 'greedy', 1, forbiddenRandom);
  assert.equal(run.text, 'The tiny robot discovered a glowing garden beneath the city.');
  assert.equal(run.steps[1]!.context, 'The tiny robot discovered a glowing');
  assert.ok(Math.abs(run.steps[0]!.candidates[0]!.probability - 0.55) < 1e-12);
  assert.ok(Math.abs(run.steps[1]!.candidates[0]!.probability - 0.5) < 1e-12);
  for (const temperature of [0.2, 2]) {
    assert.equal(generateRun(robot, 'greedy', temperature, forbiddenRandom).text, run.text);
  }
});

test('a sampled prefix changes the next conditional distribution', () => {
  const run = generateRun(robot, 'sample', 1, () => 0.6);
  assert.equal(run.steps[0]!.selected.id, 'hidden');
  assert.equal(run.steps[1]!.context, 'The tiny robot discovered a hidden');
  assert.ok(Math.abs(run.steps[1]!.candidates[0]!.probability - 0.3) < 1e-12);
  assert.notEqual(run.steps[1]!.candidates[0]!.probability, 0.5);
});

test('all curated scenarios produce three complete choices without mutating their model', () => {
  const before = JSON.stringify(SCENARIOS);
  for (const scenario of SCENARIOS) {
    for (const mode of ['rules', 'greedy', 'sample'] as const) {
      for (const draw of [0, 0.5, 0.999999]) {
        const run = generateRun(scenario, mode, 1, () => draw);
        assert.equal(run.steps.length, 3);
        assert.ok(run.text.startsWith(`${scenario.prompt} `));
        assert.ok(run.text.endsWith('.'));
        assert.ok(run.steps.every((step) => step.candidates.some(
          (candidate) => candidate.choice.id === step.selected.id,
        )));
      }
    }
  }
  assert.equal(JSON.stringify(SCENARIOS), before);
});

test('a locked 50-run batch replays exactly but still contains varied sampled outputs', () => {
  const options = { count: 50, temperature: 1, seed: 42 };
  const first = createBatch(robot, options);
  assert.equal(first.length, 50);
  assert.deepEqual(createBatch(robot, options), first);
  assert.equal(new Set(first.map((run) => run.rules.signature)).size, 1);
  assert.equal(new Set(first.map((run) => run.greedy.signature)).size, 1);
  assert.ok(new Set(first.map((run) => run.sample.signature)).size >= 6);
  assert.notDeepEqual(createBatch(robot, { ...options, seed: 43 }), first);
});

test('a one-run batch repeats when invoked with the same seed', () => {
  const options = { count: 1, temperature: 1.4, seed: 0 };
  assert.deepEqual(createBatch(robot, options), createBatch(robot, options));
});

test('invalid batch sizes and broken rule routes fail instead of silently truncating', () => {
  for (const count of [0, -1, 1.5, 51, NaN]) {
    assert.throws(() => createBatch(robot, { count, temperature: 1, seed: 42 }), RangeError);
  }
  assert.throws(() => generateRun(
    { ...robot, rulePath: ['missing', 'key', 'city'] }, 'rules', 1, () => 0,
  ), /rule/i);
});

test('many seeded draws approximate the displayed odds rather than uniform randomness', () => {
  const random = createSeededRandom(1234);
  const counts = [0, 0, 0];
  for (let index = 0; index < 10_000; index++) {
    const selected = sampleIndex([0.55, 0.3, 0.15], random());
    counts[selected] = counts[selected]! + 1;
  }
  for (const [index, expected] of [0.55, 0.3, 0.15].entries()) {
    assert.ok(Math.abs(counts[index]! / 10_000 - expected) < 0.02);
  }
});

test('history retains all aggregate counts but only the most recent 50 results', () => {
  const history = createHistory();
  assert.equal(history.total, 0);
  assert.equal(history.groups.sample.size, 0);
  for (const seed of [1, 2, 3]) {
    for (const run of createBatch(robot, { count: 50, temperature: 1, seed })) {
      recordRun(history, run);
    }
  }
  assert.equal(history.total, 150);
  assert.equal(history.recent.length, 50);
  assert.equal(history.groups.rules.size, 1);
  assert.equal(history.groups.greedy.size, 1);
  assert.ok(history.groups.sample.size > 1 && history.groups.sample.size <= 27);
  for (const mode of ['rules', 'greedy', 'sample'] as const) {
    assert.equal(
      [...history.groups[mode].values()].reduce((total, group) => total + group.count, 0),
      150,
    );
  }
});
