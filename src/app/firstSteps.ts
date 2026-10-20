import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { OverlayMode } from '../render/overlays'
import { growth } from '../sim/farm/plants'
import type { GameState } from '../sim/state'
import { storageUsed } from '../sim/storage/storage'
import { useGameStore } from './store'
import { useViewStore } from './view'

export const stepIds = ['overlay', 'parcel', 'plant', 'fertilize', 'sell'] as const
export type StepId = (typeof stepIds)[number]

export type HintId = Exclude<StepId, 'sell'> | 'sellWait' | 'sellHarvest' | 'sellMarket'

export interface FirstSteps {
  steps: { id: StepId; done: boolean }[]
  next: StepId | null
  // data-testid of the button to highlight for the next step. Null while the player must wait.
  target: string | null
  // Key of the hint text in de.json.
  hint: HintId | null
}

// kept: steps that were done before, they stay done.
export function firstSteps(
  state: GameState,
  overlay: OverlayMode,
  kept: readonly StepId[] = [],
): FirstSteps {
  const plants = Object.values(state.farm.plants)
  const now: Record<StepId, boolean> = {
    overlay: overlay === 'soil',
    parcel: Object.keys(state.farm.parcels).length > 0,
    plant: plants.some((p) => p.variety === 'robusta'),
    fertilize: plants.some((p) => p.fertilized === true),
    sell: state.market.volumes.some((v) => v.kind === 'coffee'),
  }
  const steps = stepIds.map((id) => ({ id, done: now[id] || kept.includes(id) }))
  const next = steps.find((s) => !s.done)?.id ?? null
  const targets: Record<StepId, string> = {
    overlay: 'overlay-soil',
    parcel: 'tool-parcel',
    plant: 'tool-plant',
    fertilize: 'tool-fertilize',
    sell: 'tool-harvest',
  }
  if (next !== 'sell') return { steps, next, target: next && targets[next], hint: next }
  // Coffee in storage: sell it. Else harvest once a plant is ripe. Else wait for the plants.
  if (storageUsed(state.storage) > 0)
    return { steps, next, target: 'tool-market', hint: 'sellMarket' }
  if (plants.some((p) => growth(p, state.time.hour).progress >= 1))
    return { steps, next, target: 'tool-harvest', hint: 'sellHarvest' }
  return { steps, next, target: null, hint: 'sellWait' }
}

// The checklist lives in memory only, so every new game (page load) starts it open.
export const useFirstStepsStore = defineStore('firstSteps', () => {
  const game = useGameStore()
  const view = useViewStore()
  const open = ref(true)
  const kept = ref<StepId[]>([])
  const current = computed(() => firstSteps(game.state as GameState, view.overlay, kept.value))
  // Sync flush, so a step is kept before the condition can turn false again.
  watch(
    [() => game.state, () => view.overlay],
    () => {
      const done = current.value.steps.filter((s) => s.done).map((s) => s.id)
      // Assign only on a change, so the checklist does not re-render on every tick.
      if (done.length !== kept.value.length) kept.value = done
    },
    { flush: 'sync', immediate: true },
  )
  // Target of the highlight, or null when the checklist is closed.
  const guide = computed(() => (open.value ? current.value.target : null))
  return { open, current, guide }
})
