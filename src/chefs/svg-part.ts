/**
 * A declarative SVG element: a tag name plus attributes. No DOM involved.
 * Leaf shapes only — `renderSvgParts` builds a flat tree and has no way to
 * populate a container element such as `g`.
 */
export interface SvgPart {
  readonly tag: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon'
  readonly attrs: Readonly<Record<string, string>>
}
