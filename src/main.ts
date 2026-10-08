import './style.css';
import {
  createBatch,
  createHistory,
  MODES,
  parseSeed,
  recordRun,
  type ComparisonRun,
  type GenerationMode,
} from './model.ts';
import { SCENARIOS, type Scenario } from './scenarios.ts';
import { outcomeColor, renderPlot, setPlotProgress, type PlotAnimation } from './visualization.ts';

function get<T extends Element>(id: string, constructor: { new(): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) throw new Error(`Missing or invalid interface element: ${id}`);
  return element;
}

function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className: string, text?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setText(id: string, text: string): void {
  const element = get(id, HTMLElement);
  if (element.textContent !== text) element.textContent = text;
}

const MODE_INFO: Record<GenerationMode, {
  number: string; name: string; title: string; description: string; tag: string; note: string;
}> = {
  rules: {
    number: '01', name: 'Explicit rules', title: 'Follow the recipe.',
    description: 'A programmed route. The same answer, every time.',
    tag: 'RULE-BASED', note: 'No probabilities. No random draw.',
  },
  greedy: {
    number: '02', name: 'Model + top choice', title: 'Pick the most likely.',
    description: 'Calculate the odds. Always take the top choice.',
    tag: 'DETERMINISTIC DECODING', note: 'Probabilities in. A fixed choice out.',
  },
  sample: {
    number: '03', name: 'Model + sampling', title: 'Sample a possibility.',
    description: 'The same model. A weighted draw at each fork.',
    tag: 'STOCHASTIC DECODING', note: 'More likely does not mean certain.',
  },
};

function buildLanes(): void {
  const lanes = get('lanes', HTMLDivElement);
  const mosaics = get('mosaics', HTMLDivElement);
  for (const mode of MODES) {
    const info = MODE_INFO[mode];
    const lane = make('article', `lane lane-${mode}`);
    lane.id = `${mode}-lane`;
    lane.dataset.mode = mode;
    lane.dataset.revealed = '0';
    lane.style.setProperty('--lane', `var(--${mode})`);
    lane.innerHTML = `
      <header class="lane-heading">
        <div class="lane-eyebrow"><span class="lane-number">${info.number}</span><span>${info.name}</span><span class="lane-dot"></span></div>
        <h2>${info.title}</h2>
        <p>${info.description}</p>
      </header>
      <div class="plot-wrap"><svg id="${mode}-plot" class="path-plot"></svg></div>
      <div class="lane-output">
        <div class="output-label"><span>THE OUTPUT</span><span id="${mode}-output-state">NOT RUN YET</span></div>
        <p id="${mode}-output" class="output-text is-waiting">Waiting for the first run...</p>
      </div>
      <footer class="lane-footer">
        <span class="mode-tag">${info.tag}</span>
        <span class="unique-count"><strong id="${mode}-unique">0</strong> unique</span>
      </footer>`;
    lanes.append(lane);

    const mosaic = make('article', `mosaic-card mosaic-${mode}`);
    mosaic.style.setProperty('--lane', `var(--${mode})`);
    mosaic.innerHTML = `
      <header><h3><span class="mosaic-swatch"></span>${info.name}</h3><span id="${mode}-mosaic-count">0 outputs</span></header>
      <ol class="mosaic" id="${mode}-mosaic" aria-label="${info.name}: latest completed outputs"></ol>
      <p>${info.note}</p>`;
    mosaics.append(mosaic);
  }
}

buildLanes();

const scenarioSelect = get('scenario-select', HTMLSelectElement);
const temperatureInput = get('temperature', HTMLInputElement);
const seedLock = get('seed-lock', HTMLInputElement);
const seedInput = get('seed-input', HTMLInputElement);
const runButton = get('run-once', HTMLButtonElement);
const batchButton = get('run-batch', HTMLButtonElement);
const pauseButton = get('pause', HTMLButtonElement);
const errorNotice = get('runtime-error', HTMLDivElement);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

for (const story of SCENARIOS) {
  const option = make('option', '', story.name);
  option.value = story.id;
  scenarioSelect.append(option);
}

const firstScenario = SCENARIOS[0];
if (!firstScenario) throw new Error('The demo needs at least one story.');
let scenario: Scenario = firstScenario;
let temperature = 1;
let history = createHistory();
let revealed = 0;
let inspectMode: 'greedy' | 'sample' = 'sample';
let inspectDecision = 0;
let showAllOutcomes = false;
let lastSeed: number | undefined;
let frameId: number | undefined;
let plotAnimations: PlotAnimation[] = [];

interface Playback {
  readonly batch: readonly ComparisonRun[];
  readonly duration: number;
  index: number;
  elapsed: number;
  lastTime: number | undefined;
  paused: boolean;
}

let playback: Playback | undefined;

function preview(): ComparisonRun {
  const run = createBatch(scenario, { count: 1, temperature, seed: 42 })[0];
  if (!run) throw new Error('The story preview could not be created.');
  return run;
}

let current = preview();

function clearError(): void {
  errorNotice.hidden = true;
  errorNotice.textContent = '';
  seedInput.setAttribute('aria-invalid', 'false');
}

function showSeedError(error: RangeError): void {
  errorNotice.textContent = error.message;
  errorNotice.hidden = false;
  seedInput.setAttribute('aria-invalid', 'true');
  setText('playback-status', 'Check the random seed');
}

function cancelFrame(): void {
  if (frameId !== undefined) cancelAnimationFrame(frameId);
  frameId = undefined;
}

function renderControls(): void {
  runButton.disabled = Boolean(playback);
  batchButton.disabled = Boolean(playback);
  pauseButton.disabled = !playback;
  pauseButton.setAttribute('aria-label', playback?.paused ? 'Resume animation' : 'Pause animation');
  pauseButton.title = playback?.paused ? 'Resume animation' : 'Pause animation';
  setText('pause-glyph', playback?.paused ? '>' : 'II');
  get('playback-dot', HTMLSpanElement).classList.toggle('is-running', Boolean(playback && !playback.paused));
  const status = playback
    ? playback.paused ? 'Paused - one decision at a time' : 'Running the experiment'
    : history.total > 0 ? `${history.total} comparisons complete` : 'Ready when you are';
  setText('playback-status', status);
  setText('run-progress', playback && playback.batch.length > 1
    ? `${String(playback.index + 1).padStart(2, '0')} / ${playback.batch.length}` : '');
  seedInput.disabled = !seedLock.checked;
  setText('seed-help', seedLock.checked
    ? 'Same seed, same sequence on each click. A batch still varies within its sequence.'
    : 'A fresh seed for every click. Lock it to replay a sequence.');
  get('motion-note', HTMLSpanElement).hidden = !reducedMotion.matches;
}

function renderPlots(): void {
  plotAnimations = [];
  for (const mode of MODES) {
    get(`${mode}-lane`, HTMLElement).dataset.revealed = String(revealed);
    const animation = renderPlot(get(`${mode}-plot`, SVGSVGElement), {
      scenario, mode, current: current[mode], revealed, temperature,
      groups: history.groups[mode].values(), playing: Boolean(playback),
    });
    if (animation) {
      plotAnimations.push(animation);
      setPlotProgress(animation, playback ? playback.elapsed / playback.duration : 0);
    }
  }
}

function renderOutputs(): void {
  for (const mode of MODES) {
    const output = get(`${mode}-output`, HTMLParagraphElement);
    const last = history.recent.at(-1)?.[mode];
    const visibleResult = revealed > 0 ? current[mode] : last;
    output.replaceChildren();
    output.classList.toggle('is-waiting', !visibleResult);
    if (!visibleResult) {
      output.textContent = 'Waiting for the first run...';
      setText(`${mode}-output-state`, 'NOT RUN YET');
    } else {
      const prefix = make('span', 'output-prefix', `${scenario.prompt} `);
      const count = revealed === 0 ? 3 : revealed;
      const continuation = visibleResult.steps.slice(0, count).map((step) => step.selected.text).join(' ');
      output.append(prefix, make('span', 'output-continuation', continuation));
      if (count < 3) output.append(make('span', 'output-cursor', ' ...'));
      setText(`${mode}-output-state`, count < 3 ? `DECISION ${count} / 3` : 'COMPLETE');
    }
    setText(`${mode}-unique`, String(history.groups[mode].size));
  }
}

function renderInspector(): void {
  const result = current[inspectMode];
  const decision = result.steps[inspectDecision];
  if (!decision) throw new Error('The selected decision is missing.');
  const selected = inspectDecision < revealed;
  setText('choice-context', `${decision.context} ...`);
  setText('inspection-state', selected ? 'Choice made' : 'Next choice');
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-inspect-mode]')) {
    button.setAttribute('aria-pressed', String(button.dataset.inspectMode === inspectMode));
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-decision]')) {
    const index = Number(button.dataset.decision);
    button.disabled = index > revealed;
    button.setAttribute('aria-pressed', String(index === inspectDecision));
  }
  const bars = get('probability-bars', HTMLDivElement);
  bars.style.setProperty('--inspection-color', `var(--${inspectMode})`);
  bars.replaceChildren();
  for (const candidate of decision.candidates) {
    const chosen = selected && candidate.choice.id === decision.selected.id;
    const row = make('div', chosen ? 'probability-row is-chosen' : 'probability-row');
    row.setAttribute('role', 'listitem');
    const name = make('div', 'probability-label');
    name.append(make('span', '', candidate.choice.text));
    if (chosen) name.append(make('span', 'selected-badge', 'SELECTED'));
    const track = make('div', 'probability-track');
    const fill = make('span', 'probability-fill');
    fill.style.width = `${candidate.probability * 100}%`;
    track.setAttribute('aria-hidden', 'true');
    track.append(fill);
    row.append(name, track, make('span', 'probability-value', `${Math.round(candidate.probability * 100)}%`));
    bars.append(row);
  }
  setText('choice-explanation', inspectMode === 'greedy'
    ? 'No dice here. A deterministic selection rule always takes the highest probability.'
    : selected
      ? `This draw chose "${decision.selected.text}" from the weighted possibilities. Another draw could choose differently.`
      : 'A weighted draw can select any possible branch. Likely is not the same as certain.');
}

function renderResults(): void {
  setText('total-runs', String(history.total));
  setText('sample-result-count', String(history.groups.sample.size));
  setText('seed-used', lastSeed === undefined ? 'Last seed: --' : `Last seed: ${lastSeed}`);
  for (const mode of MODES) {
    const count = history.groups[mode].size;
    setText(`${mode}-mosaic-count`, `${count} ${count === 1 ? 'output' : 'outputs'}`);
    const mosaic = get(`${mode}-mosaic`, HTMLOListElement);
    mosaic.replaceChildren();
    for (let index = 0; index < 50; index++) {
      const result = history.recent[index]?.[mode];
      const tile = make('li', result ? 'mosaic-tile' : 'mosaic-placeholder');
      if (result) {
        const number = history.total - history.recent.length + index + 1;
        tile.title = `Run ${number}: ${result.text}`;
        tile.setAttribute('aria-label', tile.title);
        tile.style.backgroundColor = outcomeColor(result);
      } else {
        tile.setAttribute('aria-hidden', 'true');
      }
      mosaic.append(tile);
    }
  }

  const cards = get('outcome-cards', HTMLDivElement);
  cards.replaceChildren();
  const groups = [...history.groups.sample.values()].sort((left, right) => right.count - left.count);
  if (groups.length === 0) {
    const empty = make('div', 'outcomes-empty');
    empty.append(make('span', 'empty-orbit', '+'), make('p', '', 'Your possible futures will appear here.'));
    cards.append(empty);
  }
  for (const group of showAllOutcomes ? groups : groups.slice(0, 6)) {
    const card = make('article', 'outcome-card');
    const color = outcomeColor(group.result);
    card.style.setProperty('--outcome-color', color);
    const header = make('div', 'outcome-card-heading');
    const dot = make('span', 'outcome-dot');
    dot.setAttribute('aria-hidden', 'true');
    header.append(dot, make('span', '', `${group.count} ${group.count === 1 ? 'time' : 'times'}`));
    const text = make('p', '');
    text.append(make('span', 'outcome-prefix', `${scenario.prompt} `));
    text.append(make('span', '', group.result.steps.map((step) => step.selected.text).join(' ')));
    card.append(header, text);
    cards.append(card);
  }
  const showAll = get('show-all', HTMLButtonElement);
  showAll.hidden = groups.length <= 6;
  showAll.textContent = showAllOutcomes ? 'Show fewer outcomes' : `Show all ${groups.length} outcomes`;
  showAll.setAttribute('aria-expanded', String(showAllOutcomes));
}

function render(resultsChanged = false): void {
  renderControls();
  renderPlots();
  renderOutputs();
  renderInspector();
  if (resultsChanged) renderResults();
}

function resetExperiment(): void {
  cancelFrame();
  playback = undefined;
  history = createHistory();
  revealed = 0;
  inspectDecision = 0;
  showAllOutcomes = false;
  lastSeed = undefined;
  current = preview();
  clearError();
  setText('prompt-text', `${scenario.prompt} ...`);
  setText('temperature-value', temperature.toFixed(1));
  temperatureInput.setAttribute('aria-valuetext', `${temperature.toFixed(1)} - ${temperature < 1 ? 'more focused' : temperature > 1 ? 'more varied' : 'original probabilities'}`);
  render(true);
}

function finishPlayback(): void {
  cancelFrame();
  playback = undefined;
  revealed = 3;
  inspectDecision = 2;
  render(true);
}

function completeWithoutMotion(): void {
  const active = playback;
  if (!active) return;
  for (const run of active.batch.slice(active.index)) {
    current = run;
    recordRun(history, run);
  }
  finishPlayback();
}

function advanceDecision(): void {
  const active = playback;
  if (!active) return;
  revealed++;
  inspectDecision = Math.min(revealed, 2);
  let resultsChanged = false;
  if (revealed === 3) {
    recordRun(history, current);
    resultsChanged = true;
    active.index++;
    const next = active.batch[active.index];
    if (!next) {
      finishPlayback();
      return;
    }
    current = next;
    revealed = 0;
    inspectDecision = 0;
  }
  render(resultsChanged);
}

function animate(time: number): void {
  frameId = undefined;
  const active = playback;
  if (!active || active.paused) return;
  if (active.lastTime !== undefined) active.elapsed += Math.min(time - active.lastTime, 100);
  active.lastTime = time;
  while (playback === active && active.elapsed >= active.duration) {
    active.elapsed -= active.duration;
    advanceDecision();
  }
  if (playback !== active) return;
  for (const animation of plotAnimations) setPlotProgress(animation, active.elapsed / active.duration);
  frameId = requestAnimationFrame(animate);
}

function startRun(count: number, paused = false): boolean {
  clearError();
  let seed: number;
  try {
    if (seedLock.checked) seed = parseSeed(seedInput.value);
    else {
      const values = crypto.getRandomValues(new Uint32Array(1));
      const value = values[0];
      if (value === undefined) throw new Error('The browser could not create a random seed.');
      seed = value;
    }
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showSeedError(error);
    return false;
  }
  const batch = createBatch(scenario, { count, temperature, seed });
  const first = batch[0];
  if (!first) throw new Error('The experiment did not produce a first run.');
  cancelFrame();
  playback = { batch, index: 0, duration: count === 1 ? 680 : 42, elapsed: 0, lastTime: undefined, paused };
  current = first;
  revealed = 0;
  inspectDecision = 0;
  lastSeed = seed;
  seedInput.value = String(seed);
  render();
  if (reducedMotion.matches && !paused) completeWithoutMotion();
  else if (!paused) frameId = requestAnimationFrame(animate);
  return true;
}

function pauseForInspection(): void {
  if (!playback) return;
  playback.paused = true;
  playback.lastTime = undefined;
  cancelFrame();
  renderControls();
}

runButton.addEventListener('click', () => startRun(1));
batchButton.addEventListener('click', () => startRun(50));
get('reset', HTMLButtonElement).addEventListener('click', resetExperiment);

pauseButton.addEventListener('click', () => {
  if (!playback) return;
  if (!playback.paused) pauseForInspection();
  else {
    playback.paused = false;
    playback.lastTime = undefined;
    renderControls();
    if (reducedMotion.matches) completeWithoutMotion();
    else frameId = requestAnimationFrame(animate);
  }
});

get('step', HTMLButtonElement).addEventListener('click', () => {
  if (!playback && !startRun(1, true)) return;
  pauseForInspection();
  if (playback) playback.elapsed = 0;
  advanceDecision();
});

scenarioSelect.addEventListener('change', () => {
  const selected = SCENARIOS.find((story) => story.id === scenarioSelect.value);
  if (!selected) throw new Error('Choose one of the curated story prompts.');
  scenario = selected;
  resetExperiment();
});

temperatureInput.addEventListener('input', () => {
  temperature = Number(temperatureInput.value);
  resetExperiment();
});

seedLock.addEventListener('change', resetExperiment);
seedInput.addEventListener('input', () => {
  resetExperiment();
  if (!seedLock.checked) return;
  try {
    parseSeed(seedInput.value);
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    showSeedError(error);
  }
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-inspect-mode]')) {
  button.addEventListener('click', () => {
    const mode = button.dataset.inspectMode;
    if (mode !== 'greedy' && mode !== 'sample') throw new Error('Unknown probability view.');
    pauseForInspection();
    inspectMode = mode;
    renderInspector();
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-decision]')) {
  button.addEventListener('click', () => {
    pauseForInspection();
    inspectDecision = Number(button.dataset.decision);
    renderInspector();
  });
}

get('show-all', HTMLButtonElement).addEventListener('click', () => {
  showAllOutcomes = !showAllOutcomes;
  renderResults();
});

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && playback && !playback.paused) completeWithoutMotion();
  renderControls();
});

window.addEventListener('error', (event) => {
  cancelFrame();
  playback = undefined;
  renderControls();
  errorNotice.textContent = `The experiment stopped: ${event.message}`;
  errorNotice.hidden = false;
});

resetExperiment();
