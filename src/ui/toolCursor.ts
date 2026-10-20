import { isBrushTool, type BrushTool } from '../app/selection'

// Each icon fills the 16 × 16 box at the lower right of the 32 × 32 cursor.
const icons: Record<BrushTool, string> = {
  parcel:
    '<rect x="1" y="1" width="14" height="14" rx="2" fill="#f2c48d"/><path d="M8 4v8M4 8h8" fill="none"/>',
  plant:
    '<path d="M8 15V7" fill="none"/><path d="M8 9C8 4 4 2 1 3c0 4 3 6 7 6zM8 7c0-4 3-6 7-5 0 4-3 5-7 5z" fill="#7bc96f"/>',
  fertilize:
    '<path d="M4 1h8l-1 3c3 2 4 5 4 8 0 2-1 3-3 3H4c-2 0-3-1-3-3 0-3 1-6 4-8z" fill="#c79a5b"/>',
  irrigate: '<path d="M8 1C5 6 3 8 3 11a5 5 0 0 0 10 0c0-3-2-5-5-10z" fill="#5aa9e6"/>',
  protect: '<path d="M8 1l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V3z" fill="#b9a3e3"/>',
  harvest:
    '<ellipse cx="8" cy="8" rx="5.5" ry="7" fill="#c0392b"/><path d="M8 2c-2 3 2 9 0 12" fill="none"/>',
}

// The CSS cursor of the canvas: the tool icon for an armed brush tool, else the default cursor.
// The hot spot is the small ring at the upper left, so the icon does not cover the parcel.
export function toolCursor(tool: string): string {
  if (!isBrushTool(tool)) return ''
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" stroke="#2b2420" stroke-width="1.5" stroke-linejoin="round">' +
    '<circle cx="5" cy="5" r="3.5" fill="#fff"/>' +
    `<g transform="translate(14 14)">${icons[tool]}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 5 5, crosshair`
}
