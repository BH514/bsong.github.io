import type { Choice, DecisionNode, Scenario } from './scenarios.ts';

export const MODES = ['rules', 'greedy', 'sample'] as const;
export type GenerationMode = typeof MODES[number];
export type RandomSource = () => number;

export interface Candidate {
  readonly choice: Choice;
  readonly probability: number;
}

export interface DecisionStep {
  readonly context: string;
  readonly selected: Choice;
  readonly candidates: readonly Candidate[];
}

export interface RunResult {
  readonly mode: GenerationMode;
  readonly text: string;
  readonly signature: string;
  readonly steps: readonly DecisionStep[];
}

export type ComparisonRun = Readonly<Record<GenerationMode, RunResult>>;

export interface OutcomeGroup {
  readonly result: RunResult;
  count: number;
}

export interface RunHistory {
  total: number;
  readonly recent: ComparisonRun[];
  readonly groups: Record<GenerationMode, Map<string, OutcomeGroup>>;
}

function validateTemperature(temperature: number): void {
  if (!Number.isFinite(temperature) || temperature < 0.2 || temperature > 2) {
    throw new RangeError('Temperature must be between 0.2 and 2.0.');
  }
}

function validateSeed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError('Enter a whole-number seed from 0 to 4294967295.');
  }
}

export function parseSeed(raw: string): number {
  if (!/^\d+$/.test(raw.trim())) {
    throw new RangeError('Enter a whole-number seed from 0 to 4294967295.');
  }
  const seed = Number(raw.trim());
  validateSeed(seed);
  return seed;
}

export function distribution(choices: readonly Choice[], temperature: number): Candidate[] {
  validateTemperature(temperature);
  if (choices.length === 0 || choices.some(
    (choice) => !Number.isFinite(choice.weight) || choice.weight < 0,
  ) || !choices.some((choice) => choice.weight > 0)) {
    throw new RangeError('Choices need finite, nonnegative weights with at least one possible outcome.');
  }

  // Log-space scaling keeps even very large weights numerically stable.
  const logits = choices.map((choice) => Math.log(choice.weight) / temperature);
  const maximum = Math.max(...logits);
  const scaled = logits.map((logit) => Math.exp(logit - maximum));
  const total = scaled.reduce((sum, value) => sum + value, 0);
  return choices.map((choice, index) => {
    const value = scaled[index];
    if (value === undefined) throw new Error('A choice lost its probability.');
    return { choice, probability: value / total };
  });
}

export function sampleIndex(probabilities: readonly number[], draw: number): number {
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
    throw new RangeError('A random draw must be in the interval [0, 1).');
  }
  const total = probabilities.reduce((sum, probability) => sum + probability, 0);
  if (probabilities.length === 0 || probabilities.some(
    (probability) => !Number.isFinite(probability) || probability < 0,
  ) || Math.abs(total - 1) > 1e-10) {
    throw new RangeError('Sampling requires normalized, nonnegative probabilities.');
  }
  const lastPossible = probabilities.reduce(
    (last, probability, index) => probability > 0 ? index : last, -1,
  );
  let cumulative = 0;
  for (const [index, probability] of probabilities.entries()) {
    cumulative += probability;
    if (probability > 0 && (draw < cumulative || index === lastPossible)) return index;
  }
  throw new Error('No outcome matched the random draw.');
}

export function createSeededRandom(seed: number): RandomSource {
  validateSeed(seed);
  let state = seed;
  // Mulberry32 provides reproducible teaching sequences, not cryptographic randomness.
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRun(
  scenario: Scenario,
  mode: GenerationMode,
  temperature: number,
  random: RandomSource,
): RunResult {
  validateTemperature(temperature);
  if (!MODES.includes(mode)) throw new RangeError('Unknown generation mode.');
  if (scenario.rulePath.length !== 3) throw new Error('A story rule must contain three decisions.');
  let node: DecisionNode | undefined = scenario.root;
  let context = scenario.prompt;
  const steps: DecisionStep[] = [];

  for (let index = 0; index < 3; index++) {
    if (!node) throw new Error('A story ended before its third decision.');
    let candidates: Candidate[];
    let selected: Choice;

    if (mode === 'rules') {
      const ruleChoice: Choice | undefined = node.choices.find(
        (choice) => choice.id === scenario.rulePath[index],
      );
      if (!ruleChoice) throw new Error('The explicit rule points to a missing story choice.');
      selected = ruleChoice;
      candidates = [{ choice: selected, probability: 1 }];
    } else {
      candidates = distribution(node.choices, temperature);
      const candidate = mode === 'greedy'
        ? candidates.reduce((best, next) => next.probability > best.probability ? next : best)
        : candidates[sampleIndex(candidates.map((entry) => entry.probability), random())];
      if (!candidate) throw new Error('No candidate was selected.');
      selected = candidate.choice;
    }

    steps.push({ context, selected, candidates });
    context = `${context} ${selected.text}`;
    node = selected.next;
  }
  if (node) throw new Error('A story must end after exactly three decisions.');

  return {
    mode,
    text: context,
    signature: steps.map((step) => step.selected.id).join('/'),
    steps,
  };
}

export function createBatch(
  scenario: Scenario,
  options: { count: number; temperature: number; seed: number },
): ComparisonRun[] {
  if (!Number.isInteger(options.count) || options.count < 1 || options.count > 50) {
    throw new RangeError('Run between 1 and 50 comparisons at a time.');
  }
  const random = createSeededRandom(options.seed);
  const rules = generateRun(scenario, 'rules', options.temperature, random);
  const greedy = generateRun(scenario, 'greedy', options.temperature, random);
  return Array.from({ length: options.count }, () => ({
    rules,
    greedy,
    sample: generateRun(scenario, 'sample', options.temperature, random),
  }));
}

export function createHistory(): RunHistory {
  return {
    total: 0,
    recent: [],
    groups: { rules: new Map(), greedy: new Map(), sample: new Map() },
  };
}

export function recordRun(history: RunHistory, run: ComparisonRun): void {
  history.total++;
  history.recent.push(run);
  if (history.recent.length > 50) history.recent.shift();
  for (const mode of MODES) {
    const result = run[mode];
    const group = history.groups[mode].get(result.signature);
    if (group) group.count++;
    else history.groups[mode].set(result.signature, { result, count: 1 });
  }
}
