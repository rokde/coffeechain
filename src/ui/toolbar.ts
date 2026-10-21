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
  { id: 'protect', label: de.tools.protect, key: 'T' },
  { id: 'harvest', label: de.tools.harvest, key: 'N' },
  { id: 'build', label: de.tools.build, key: 'B' },
  { id: 'market', label: de.tools.market, key: 'M' },
]

// The overlay toggles after the tools. The label is short, the title is the full name.
export const overlays = [
  { id: 'soil', label: de.overlay.short.soil, title: de.overlay.soil, key: 'O' },
  { id: 'zone', label: de.overlay.short.zone, title: de.overlay.zone, key: 'Z' },
] as const
