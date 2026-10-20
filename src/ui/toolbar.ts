export interface Tool {
  id: string
  label: string
}

// Later slices add their tools here. The toolbar slot renders this list.
export const tools: Tool[] = []
