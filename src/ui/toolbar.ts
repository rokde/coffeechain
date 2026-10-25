import de from './i18n/de.json'

export interface Tool {
  id: string
  label: string
  // The upper-case letter key that picks the tool.
  key: string
}

// Later slices add their tools here. The toolbar slot renders this list. The first tool is the default.
export const tools: Tool[] = [
  { id: 'select', label: de.tools.select, key: 'V' },
  { id: 'parcel', label: de.tools.parcel, key: 'P' },
  { id: 'plant', label: de.tools.plant, key: 'L' },
  { id: 'fertilize', label: de.tools.fertilize, key: 'G' },
  { id: 'irrigate', label: de.tools.irrigate, key: 'R' },
  { id: 'harvest', label: de.tools.harvest, key: 'N' },
  { id: 'build', label: de.tools.build, key: 'B' },
  { id: 'market', label: de.tools.market, key: 'M' },
]

// The overlay toggles after the tools. The label is short, the title is the full name.
// The icon is the path of a 16 x 16 SVG.
export const overlays = [
  {
    id: 'soil',
    label: de.overlay.short.soil,
    title: de.overlay.soil,
    key: 'O',
    icon: 'M1 9h14 M1 12h14 M1 15h14 M8 9V3 M8 5c-2.5 0-3.5-1.5-3.5-3 2 0 3.5 1 3.5 3 0-2 1.5-3 3.5-3 0 1.5-1 3-3.5 3',
  },
  {
    id: 'zone',
    label: de.overlay.short.zone,
    title: de.overlay.zone,
    key: 'Z',
    icon: 'M1 14l5-9 3 5 2-3 4 7z',
  },
] as const
