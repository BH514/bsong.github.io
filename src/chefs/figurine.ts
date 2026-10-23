import type { UtensilId } from '../data/types.ts'
import type { Chef, HairStyle, HatStyle } from './roster.ts'
import type { SvgPart } from './svg-part.ts'
import { UTENSIL_PARTS } from './utensils.ts'

export const FIGURINE_VIEWBOX = '0 0 100 150'

const INK = '#17202b'
const TROUSERS = '#2b3240'

export type { SvgPart }

function hatParts(hat: HatStyle, accent: string): readonly SvgPart[] {
  switch (hat) {
    case 'tall-toque':
      return [
        { tag: 'ellipse', attrs: { cx: '50', cy: '20', rx: '21', ry: '14', fill: '#ffffff' } },
        { tag: 'circle', attrs: { cx: '34', cy: '26', r: '10', fill: '#ffffff' } },
        { tag: 'circle', attrs: { cx: '66', cy: '26', r: '10', fill: '#ffffff' } },
        { tag: 'rect', attrs: { x: '31', y: '34', width: '38', height: '9', rx: '3', fill: '#dde6ef' } },
      ]
    case 'toque':
      return [
        { tag: 'ellipse', attrs: { cx: '50', cy: '22', rx: '19', ry: '14', fill: '#ffffff' } },
        { tag: 'rect', attrs: { x: '31', y: '32', width: '38', height: '10', rx: '3', fill: '#e6ecf3' } },
      ]
    case 'bandana':
      return [
        { tag: 'path', attrs: { d: 'M30 31q20-12 40 0', stroke: accent, 'stroke-width': '9', fill: 'none', 'stroke-linecap': 'round' } },
      ]
    case 'headscarf':
      return [
        { tag: 'path', attrs: { d: 'M31 40q19-20 38 0q2-16-19-16t-19 16z', fill: accent } },
      ]
    case 'cap':
      return [
        { tag: 'path', attrs: { d: 'M32 34q18-12 36 0l2-6q-20-10-40 0z', fill: accent } },
        { tag: 'rect', attrs: { x: '68', y: '30', width: '12', height: '6', fill: accent } },
      ]
  }
}

function hairParts(hair: HairStyle): readonly SvgPart[] {
  switch (hair) {
    case 'none':
      return []
    case 'bun':
      return [{ tag: 'circle', attrs: { cx: '50', cy: '16', r: '8', fill: '#2b2320' } }]
    case 'beard':
      return [{ tag: 'path', attrs: { d: 'M36 64q14 12 29 0v8q-15 9-29 0z', fill: INK, opacity: '0.55' } }]
    case 'moustache':
      return [{ tag: 'path', attrs: { d: 'M42 65q8 6 17 0', stroke: INK, 'stroke-width': '4', fill: 'none', 'stroke-linecap': 'round' } }]
    case 'undercut':
      return [{ tag: 'path', attrs: { d: 'M44 61h13', stroke: INK, 'stroke-width': '2.6', 'stroke-linecap': 'round' } }]
  }
}

/**
 * Body parts come first and the utensil last, so a re-deal can swap the
 * utensil without rebuilding the chef.
 */
export function figurineParts(chef: Chef, utensil: UtensilId): readonly SvgPart[] {
  return [
    ...hatParts(chef.hat, chef.accent),
    { tag: 'rect', attrs: { x: '35', y: '42', width: '30', height: '30', rx: '13', fill: chef.skin } },
    { tag: 'circle', attrs: { cx: '44', cy: '54', r: '2.3', fill: INK } },
    { tag: 'circle', attrs: { cx: '57', cy: '54', r: '2.3', fill: INK } },
    ...hairParts(chef.hair),
    { tag: 'path', attrs: { d: 'M38 72h25l-12.5 12z', fill: chef.accent } },
    { tag: 'path', attrs: { d: 'M30 75q20-7 41 0v46H30z', fill: chef.coat } },
    { tag: 'path', attrs: { d: 'M50 77v44', stroke: 'rgba(0,0,0,0.16)', 'stroke-width': '2' } },
    { tag: 'path', attrs: { d: 'M30 79 16 59', stroke: chef.coat, 'stroke-width': '11', 'stroke-linecap': 'round' } },
    { tag: 'circle', attrs: { cx: '15', cy: '57', r: '5', fill: chef.skin } },
    { tag: 'path', attrs: { d: 'M71 79l13 22', stroke: chef.coat, 'stroke-width': '11', 'stroke-linecap': 'round' } },
    { tag: 'circle', attrs: { cx: '85', cy: '103', r: '5', fill: chef.skin } },
    { tag: 'rect', attrs: { x: '33', y: '120', width: '13', height: '22', rx: '2', fill: TROUSERS } },
    { tag: 'rect', attrs: { x: '55', y: '120', width: '13', height: '22', rx: '2', fill: TROUSERS } },
    ...UTENSIL_PARTS[utensil],
  ]
}
