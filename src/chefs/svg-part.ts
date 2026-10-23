/** A declarative SVG element: a tag name plus attributes. No DOM involved. */
export interface SvgPart {
  readonly tag: 'path' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'g'
  readonly attrs: Readonly<Record<string, string>>
}
