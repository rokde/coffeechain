import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { OverlayMode } from '../render/overlays'
import type { GameState } from '../sim/state'
import { storageUsed } from '../sim/storage/storage'
import { useGameStore } from './store'
import { useViewStore } from './view'

export const stepIds = ['overlay', 'parcel', 'plant', 'fertilize', 'sell'] as const
export type StepId = (typeof stepIds)[number]

export interface FirstSteps {
  steps: { id: StepId; done: boolean }[]
  next: StepId | null
  // data-testid of the button to highlight for the next step.
  target: string | null
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
    sell: storageUsed(state.storage) > 0 ? 'tool-market' : 'tool-harvest',
  }
  return { steps, next, target: next && targets[next] }
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
      kept.value = current.value.steps.filter((s) => s.done).map((s) => s.id)
    },
    { flush: 'sync', immediate: true },
  )
  // Target of the highlight, or null when the checklist is closed.
  const guide = computed(() => (open.value ? current.value.target : null))
  return { open, current, guide }
})
