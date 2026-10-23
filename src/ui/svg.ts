import type { SvgPart } from '../chefs/figurine.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Builds an SVG tree from declarative parts. Never uses innerHTML. */
export function renderSvgParts(parts: readonly SvgPart[], viewBox: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', viewBox)
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  for (const part of parts) {
    const node = document.createElementNS(SVG_NS, part.tag)
    for (const [name, value] of Object.entries(part.attrs)) {
      node.setAttribute(name, value)
    }
    svg.append(node)
  }
  return svg
}
