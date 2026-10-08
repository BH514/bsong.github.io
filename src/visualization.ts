import { distribution, type GenerationMode, type OutcomeGroup, type RunResult } from './model.ts';
import type { Choice, DecisionNode, Scenario } from './scenarios.ts';

interface Point {
  x: number;
  y: number;
}

export interface PlotAnimation {
  readonly path: SVGPathElement;
  readonly pulse: SVGCircleElement;
  readonly length: number;
}

interface PlotOptions {
  scenario: Scenario;
  mode: GenerationMode;
  current: RunResult;
  revealed: number;
  temperature: number;
  groups: Iterable<OutcomeGroup>;
  playing: boolean;
}

const ROOT: Point = { x: 18, y: 120 };
const COLUMNS = [92, 196, 302];
const ROWS = [55, 120, 185];
const OUTCOME_COLORS = [
  '#47b4bc', '#fac832', '#78a5d1', '#8cc342', '#00a6d7', '#f8d08a',
  '#c3db6a', '#0199a6', '#b9d4e9', '#c0cf30', '#84a9bf', '#a4b638',
  '#e99625', '#bbdee1', '#b6d890', '#3273af', '#bed2e0', '#0090c7',
  '#318040', '#899d3b', '#e4f4f4', '#a1d3ea', '#fcefdf', '#dfe7ec',
  '#5e88a1', '#d67921', '#037cb7',
] as const;

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Record<string, string | number>,
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function getLayers(root: DecisionNode): Choice[][] {
  const layers: Choice[][] = [[], [], []];
  function visit(node: DecisionNode, depth: number) {
    const layer = layers[depth];
    if (!layer) return;
    for (const choice of node.choices) {
      if (!layer.some((entry) => entry.id === choice.id)) layer.push(choice);
      if (choice.next) visit(choice.next, depth + 1);
    }
  }
  visit(root, 0);
  return layers;
}

function position(layers: readonly Choice[][], depth: number, id: string, mode: GenerationMode): Point {
  const index = layers[depth]?.findIndex((choice) => choice.id === id);
  const x = COLUMNS[depth];
  const y = mode === 'rules' ? ROOT.y : ROWS[index ?? -1];
  if (x === undefined || y === undefined || index === undefined || index < 0) {
    throw new Error('A story choice cannot be placed on the diagram.');
  }
  return { x, y };
}

function curve(from: Point, to: Point): string {
  const middle = (from.x + to.x) / 2;
  return `C ${middle} ${from.y}, ${middle} ${to.y}, ${to.x} ${to.y}`;
}

function route(points: readonly Point[]): string {
  let from = ROOT;
  let result = `M ${from.x} ${from.y}`;
  for (const point of points) {
    result += ` ${curve(from, point)}`;
    from = point;
  }
  return result;
}

export function outcomeColor(result: RunResult): string {
  if (result.mode !== 'sample') return `var(--${result.mode})`;
  const variant = result.steps.reduce((value, step) => {
    const index = step.candidates.findIndex((candidate) => candidate.choice.id === step.selected.id);
    if (index < 0) throw new Error('An output is missing its selected candidate.');
    return value * 3 + index;
  }, 0);
  const color = OUTCOME_COLORS[variant];
  if (!color) throw new Error('An output has no matching palette color.');
  return color;
}

export function renderPlot(svg: SVGSVGElement, options: PlotOptions): PlotAnimation | undefined {
  const { scenario, mode, current, revealed, temperature, groups, playing } = options;
  const layers = getLayers(scenario.root);
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 352 228');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', mode === 'rules'
    ? 'A fixed, programmed route through three decisions.'
    : 'Three branching decisions. Branch width represents conditional probability; trails represent completed outputs.');

  for (const [index, text] of ['DESCRIBE', 'DISCOVER', 'LOCATE'].entries()) {
    const x = COLUMNS[index];
    if (x === undefined) throw new Error('A diagram column is missing.');
    svg.append(svgElement('text', { x, y: 17, class: 'plot-column', 'text-anchor': 'middle' }, text));
  }

  if (mode === 'rules') {
    const points = current.steps.map((step, index) => position(layers, index, step.selected.id, mode));
    svg.append(svgElement('path', { d: route(points), class: 'plot-edge rule-edge' }));
    svg.append(svgElement('text', {
      x: 176, y: 213, class: 'plot-annotation', 'text-anchor': 'middle',
    }, 'A route written in advance. No draw needed.'));
  } else {
    const drawn = new Set<string>();
    function drawEdges(node: DecisionNode, depth: number, from: Point, parentId: string) {
      if (depth > 2) return;
      for (const candidate of distribution(node.choices, temperature)) {
        const to = position(layers, depth, candidate.choice.id, mode);
        const key = `${depth}-${parentId}-${candidate.choice.id}`;
        if (!drawn.has(key)) {
          svg.append(svgElement('path', {
            d: `M ${from.x} ${from.y} ${curve(from, to)}`,
            class: 'plot-edge',
            'stroke-width': 0.6 + candidate.probability * 3.8,
          }));
          drawn.add(key);
        }
        if (candidate.choice.next) drawEdges(candidate.choice.next, depth + 1, to, candidate.choice.id);
      }
    }
    drawEdges(scenario.root, 0, ROOT, 'root');
  }

  for (const group of groups) {
    const points = group.result.steps.map((step, index) => position(layers, index, step.selected.id, mode));
    svg.append(svgElement('path', {
      d: route(points),
      class: 'plot-trail',
      stroke: outcomeColor(group.result),
      'stroke-width': 1.1 + Math.min(3.5, Math.log2(group.count + 1) * 0.65),
      opacity: Math.min(0.66, 0.16 + Math.log2(group.count + 1) * 0.07),
    }));
  }

  const selectedPoints = current.steps.map((step, index) => position(layers, index, step.selected.id, mode));
  if (revealed > 0) {
    svg.append(svgElement('path', {
      d: route(selectedPoints.slice(0, revealed)), class: 'plot-active-route',
    }));
  }

  svg.append(svgElement('circle', { cx: ROOT.x, cy: ROOT.y, r: 3.5, class: 'plot-root' }));
  for (const [depth, layer] of layers.entries()) {
    const choices = mode === 'rules'
      ? layer.filter((choice) => choice.id === current.steps[depth]?.selected.id)
      : layer;
    for (const choice of choices) {
      const point = position(layers, depth, choice.id, mode);
      const selected = depth < revealed && current.steps[depth]?.selected.id === choice.id;
      if (selected) {
        svg.append(svgElement('circle', {
          cx: point.x, cy: point.y, r: 11, class: 'plot-node-halo',
        }));
      }
      svg.append(svgElement('circle', {
        cx: point.x, cy: point.y, r: selected ? 4.5 : 3.5,
        class: selected ? 'plot-node is-selected' : 'plot-node',
      }));
      const label = svgElement('text', {
        x: point.x, y: point.y + 22, 'text-anchor': 'middle',
        class: selected ? 'plot-label is-selected' : 'plot-label',
      }, choice.label);
      label.append(svgElement('title', {}, choice.text));
      svg.append(label);
    }
  }

  if (playing && revealed < 3) {
    const from = revealed === 0 ? ROOT : selectedPoints[revealed - 1];
    const to = selectedPoints[revealed];
    if (!from || !to) throw new Error('The animated decision has no endpoints.');
    const path = svgElement('path', {
      d: `M ${from.x} ${from.y} ${curve(from, to)}`,
      class: 'plot-active-route',
    });
    const pulse = svgElement('circle', {
      cx: from.x, cy: from.y, r: 4, class: 'plot-pulse',
    });
    svg.append(path, pulse);
    const animation = { path, pulse, length: path.getTotalLength() };
    setPlotProgress(animation, 0);
    return animation;
  }
  return undefined;
}

export function setPlotProgress(animation: PlotAnimation, progress: number): void {
  const distance = animation.length * Math.max(0, Math.min(1, progress));
  const point = animation.path.getPointAtLength(distance);
  animation.path.style.strokeDasharray = String(animation.length);
  animation.path.style.strokeDashoffset = String(animation.length - distance);
  animation.pulse.setAttribute('cx', String(point.x));
  animation.pulse.setAttribute('cy', String(point.y));
}
