import de from './i18n/de.json'

export interface Tool {
  id: string
  label: string
  // The upper-case letter key that picks the tool.
  key: string
  // The path of a 16 x 16 SVG, drawn as a 1.5 px line like the overlay icons.
  icon: string
}

// Later slices add their tools here. The toolbar slot renders this list. The first tool is the default.
export const tools: Tool[] = [
  { id: 'select', label: de.tools.select, key: 'V', icon: 'M3.5 2l9 5-4 1.2L6.5 12.5z' },
  { id: 'parcel', label: de.tools.parcel, key: 'P', icon: 'M2 2h12v12H2z M2 8h12 M8 2v12' },
  {
    id: 'plant',
    label: de.tools.plant,
    key: 'L',
    icon: 'M8 14V7 M8 9C5 9 3 7 3 4c3 0 5 2 5 5 M8 7c0-3 2-5 5-5 0 3-2 5-5 5 M4 14h8',
  },
  {
    id: 'fertilize',
    label: de.tools.fertilize,
    key: 'G',
    icon: 'M4 5h8l1 9H3z M5 5l1-3h4l1 3 M6 9.5h4',
  },
  {
    id: 'irrigate',
    label: de.tools.irrigate,
    key: 'R',
    icon: 'M8 2c2.5 3 4.5 5.5 4.5 8a4.5 4.5 0 0 1-9 0C3.5 7.5 5.5 5 8 2z',
  },
  {
    id: 'harvest',
    label: de.tools.harvest,
    key: 'N',
    icon: 'M2 7h12l-1.5 7h-9z M5 7l3-5 3 5 M6 10v2 M10 10v2',
  },
  {
    id: 'build',
    label: de.tools.build,
    key: 'B',
    icon: 'M2 8l6-6 6 6 M4 6.5V14h8V6.5 M7 14v-4h2v4',
  },
  {
    id: 'market',
    label: de.tools.market,
    key: 'M',
    icon: 'M2 6l1.5-4h9L14 6z M3 6v8h10V6 M6 14v-4h4v4',
  },
]

// On narrow screens these tools share one toolbar entry, and so do the overlays.
export const fieldTools = ['parcel', 'plant', 'fertilize', 'irrigate', 'harvest']
export const viewIcon = 'M8 2l6 3-6 3-6-3z M2 8l6 3 6-3 M2 11l6 3 6-3'

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
