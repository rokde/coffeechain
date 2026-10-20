import de from './i18n/de.json'

export interface Tool {
  id: string
  label: string
}

// Later slices add their tools here. The toolbar slot renders this list. The first tool is the default.
export const tools: Tool[] = [
  { id: 'select', label: de.tools.select },
  { id: 'parcel', label: de.tools.parcel },
  { id: 'plant', label: de.tools.plant },
  { id: 'fertilize', label: de.tools.fertilize },
  { id: 'irrigate', label: de.tools.irrigate },
  { id: 'protect', label: de.tools.protect },
  { id: 'harvest', label: de.tools.harvest },
  { id: 'market', label: de.tools.market },
]
