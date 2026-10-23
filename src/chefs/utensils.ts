import type { UtensilId } from '../data/types.ts'
import type { SvgPart } from './svg-part.ts'

const STEEL = '#cfd8e3'
const HANDLE = '#2b3240'
const WOOD = '#b98a5a'

/**
 * Each utensil is drawn in the raised hand, around x 1..37 / y 20..60 in the
 * 100x150 figurine viewBox. Geometry traced from the approved mockup.
 */
export const UTENSIL_PARTS: Readonly<Record<UtensilId, readonly SvgPart[]>> = {
  knife: [
    { tag: 'rect', attrs: { x: '6', y: '22', width: '4', height: '30', rx: '2', fill: STEEL } },
    { tag: 'rect', attrs: { x: '4', y: '50', width: '9', height: '8', rx: '2', fill: HANDLE } },
  ],
  cleaver: [
    { tag: 'rect', attrs: { x: '3', y: '24', width: '14', height: '20', rx: '2', fill: STEEL } },
    { tag: 'rect', attrs: { x: '8', y: '44', width: '5', height: '14', rx: '2', fill: HANDLE } },
  ],
  whisk: [
    { tag: 'path', attrs: { d: 'M10 24q-7 12 0 22q7-10 0-22', fill: 'none', stroke: STEEL, 'stroke-width': '2' } },
    { tag: 'path', attrs: { d: 'M10 24v22', stroke: STEEL, 'stroke-width': '2' } },
    { tag: 'rect', attrs: { x: '7', y: '46', width: '6', height: '12', rx: '3', fill: HANDLE } },
  ],
  pan: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '40', rx: '11', ry: '5', fill: STEEL } },
    { tag: 'rect', attrs: { x: '21', y: '38', width: '16', height: '3', rx: '1.5', fill: HANDLE } },
  ],
  wok: [
    { tag: 'path', attrs: { d: 'M1 36h22a11 11 0 0 1-22 0', fill: '#3c4756' } },
    { tag: 'ellipse', attrs: { cx: '12', cy: '36', rx: '11', ry: '3', fill: '#59667a' } },
    { tag: 'rect', attrs: { x: '21', y: '34', width: '15', height: '3', rx: '1.5', fill: HANDLE } },
  ],
  'rolling-pin': [
    { tag: 'rect', attrs: { x: '2', y: '32', width: '24', height: '8', rx: '4', fill: WOOD } },
    { tag: 'rect', attrs: { x: '26', y: '34', width: '7', height: '4', rx: '2', fill: HANDLE } },
  ],
  tongs: [
    { tag: 'path', attrs: { d: 'M8 24l6 18m6-18l-6 18', stroke: STEEL, 'stroke-width': '2.6', fill: 'none', 'stroke-linecap': 'round' } },
    { tag: 'rect', attrs: { x: '11', y: '42', width: '6', height: '12', rx: '3', fill: HANDLE } },
  ],
  spoon: [
    { tag: 'ellipse', attrs: { cx: '12', cy: '28', rx: '6', ry: '8', fill: WOOD } },
    { tag: 'rect', attrs: { x: '10', y: '34', width: '4', height: '24', rx: '2', fill: WOOD } },
  ],
}
