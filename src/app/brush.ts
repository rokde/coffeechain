import type { ParcelPos } from '../render/picking'
import type { Command } from '../sim/commands'
import { quoteCare } from '../sim/farm/care'
import { quoteParcels } from '../sim/farm/parcels'
import { quotePlant } from '../sim/farm/plants'
import type { Variety } from '../sim/farm/yield'
import { isVarietyUnlocked } from '../sim/progression/capital'
import type { GameState } from '../sim/state'
import { canSelect, farmTools, type BrushTool } from './selection'

export type BrushNote = 'invalid' | 'money'

// A right-click that moves less than this many pixels is a click, not a pan.
export const CLICK_SLOP = 4
export const isClick = (dx: number, dy: number) => Math.hypot(dx, dy) < CLICK_SLOP

// The command of the tool for one parcel, or a note when the tool cannot act on it.
// It never gives a command that costs more than state.money, so the sim does not throw.
export function brushParcel(
  state: GameState,
  tool: BrushTool,
  variety: Variety,
  p: ParcelPos,
): Command | BrushNote {
  if (!canSelect(state, tool, p)) return 'invalid'
  const parcels = [p]
  let command: Command
  let cost = 0
  if (tool === 'parcel') {
    command = { type: 'CreateParcels', parcels }
    cost = quoteParcels(state, parcels)
  } else if (tool === 'plant') {
    if (!isVarietyUnlocked(state, variety)) return 'invalid'
    command = { type: 'Plant', variety, parcels }
    cost = quotePlant(state, variety, 1)
  } else if (tool === 'harvest') command = { type: 'Harvest', parcels }
  else {
    const care = { type: farmTools[tool], parcels }
    command = care
    cost = quoteCare(state, care)
  }
  return cost > state.money ? 'money' : command
}

// One stroke acts on each parcel at most once. It gives undefined for a parcel that the stroke already visited.
export function strokeParcel(
  visited: Set<number>,
  state: GameState,
  tool: BrushTool,
  variety: Variety,
  p: ParcelPos,
): Command | BrushNote | undefined {
  const index = p.y * state.world.size + p.x
  if (visited.has(index)) return undefined
  visited.add(index)
  return brushParcel(state, tool, variety, p)
}
