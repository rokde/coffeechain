<script setup lang="ts">
import { computed } from 'vue'
import { useFirstStepsStore } from '../app/firstSteps'
import { isFarmTool, pickTool, useSelectionStore } from '../app/selection'
import { useSavePanelStore } from '../app/savePanel'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import { capital, phase, phaseProgress } from '../sim/progression/capital'
import type { GameState } from '../sim/state'
import { storageCapacity } from '../sim/storage/capacity'
import { storageUsed } from '../sim/storage/storage'
import { clock } from '../sim/time/time'
import de from './i18n/de.json'
import { formatMoney } from './money'
import EventChips from './EventChips.vue'
import FirstSteps from './FirstSteps.vue'
import FarmTool from './FarmTool.vue'
import FpsMeter from './FpsMeter.vue'
import HelpOverlay from './HelpOverlay.vue'
import MarketPanel from './MarketPanel.vue'
import MessagePanel from './MessagePanel.vue'
import BuildTool from './BuildTool.vue'
import ParcelInspector from './ParcelInspector.vue'
import OverlayPanel from './OverlayPanel.vue'
import ParcelTool from './ParcelTool.vue'
import PlantTool from './PlantTool.vue'
import SavePanel from './SavePanel.vue'
import { tools } from './toolbar'

const store = useGameStore()
const selection = useSelectionStore()
const steps = useFirstStepsStore()
const view = useViewStore()
const savePanel = useSavePanelStore()
const speeds = balance().time.speeds
const clockText = computed(() => {
  const { day, hourOfDay } = clock(store.state.time.hour)
  return {
    day: de.time.day.replace('{day}', String(day)),
    hour: de.time.hour.replace('{hour}', String(hourOfDay).padStart(2, '0')),
  }
})
// The helpers only read the state, so the cast of the readonly snapshot is safe.
const storageText = computed(() =>
  de.storage
    .replace('{used}', String(storageUsed((store.state as GameState).storage)))
    .replace('{capacity}', String(storageCapacity(store.state as GameState))),
)
const phaseText = computed(() => {
  const state = store.state as GameState
  const { next, share } = phaseProgress(state)
  const name = de.phase.name.replace('{phase}', String(phase(state)))
  // Round down, so the chip never shows 100 % before the next phase.
  const progress =
    next === null ? '' : de.phase.progress.replace('{percent}', String(Math.floor(share * 100)))
  // Also the only progress at 480 px or less, where the percent is hidden.
  const hint =
    next === null
      ? de.phase.lastHint
      : de.phase.hint
          .replace('{capital}', formatMoney(capital(state)))
          .replace('{next}', formatMoney(next * 100))
  return { name, progress, hint, label: `${[name, progress].filter(Boolean).join(' ')} · ${hint}` }
})
</script>

<template>
  <div class="hud">
    <header class="frame top-bar" data-testid="hud-top-bar">
      <div class="name">
        <strong>{{ de.game.name }}</strong>
        <small data-testid="world-seed">{{
          de.world.seed.replace('{seed}', String(store.state.world.seed))
        }}</small>
      </div>
      <div class="time">
        <span class="chip clock" data-testid="clock"
          ><span>{{ clockText.day }}</span
          ><span class="clock-separator">{{ de.time.separator }}</span
          ><span>{{ clockText.hour }}</span></span
        >
        <div class="speeds" role="group" :aria-label="de.time.speeds">
          <button
            v-for="speed in speeds"
            :key="speed"
            type="button"
            :data-testid="`speed-${speed}`"
            :aria-label="speed === 0 ? de.time.pause : undefined"
            :aria-pressed="store.state.time.speed === speed"
            @click="store.dispatch({ type: 'SetSpeed', speed })"
          >
            <svg v-if="speed === 0" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
              <rect x="1" y="1" width="2.5" height="8" fill="currentColor" />
              <rect x="6.5" y="1" width="2.5" height="8" fill="currentColor" />
            </svg>
            <template v-else>{{ de.time.speed.replace('{speed}', String(speed)) }}</template>
          </button>
        </div>
      </div>
      <div class="stats">
        <EventChips />
        <span class="chip" data-testid="storage">{{ storageText }}</span>
        <span class="chip" data-testid="phase" :title="phaseText.hint" :aria-label="phaseText.label"
          >{{ phaseText.name }}
          <span v-if="phaseText.progress" class="phase-progress">{{
            phaseText.progress
          }}</span></span
        >
        <span class="chip money" data-testid="money">{{ formatMoney(store.state.money) }}</span>
      </div>
      <button
        type="button"
        class="save-button"
        data-testid="save-button"
        :aria-label="de.savePanel.open"
        @click="savePanel.open = true"
      >
        <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
          <path
            d="M2 2h9l3 3v9H2z M4.5 2v4h6V2 M4.5 14V9.5h7V14"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
        </svg>
        <span>{{ de.savePanel.open }}</span>
      </button>
      <button
        type="button"
        class="help-button"
        data-testid="help-button"
        :aria-label="de.help.open"
        @click="view.toggleHelp()"
      >
        ?
      </button>
    </header>
    <aside class="frame left-panel" data-testid="hud-left-panel">
      <FirstSteps v-if="steps.open" /><MessagePanel v-else />
    </aside>
    <OverlayPanel />
    <aside class="frame right-panel" data-testid="hud-right-panel">
      <ParcelTool v-if="selection.tool === 'parcel'" />
      <PlantTool v-else-if="selection.tool === 'plant'" />
      <FarmTool v-else-if="isFarmTool(selection.tool)" />
      <BuildTool v-else-if="selection.tool === 'build'" />
      <MarketPanel v-else-if="selection.tool === 'market'" />
      <ParcelInspector v-else />
    </aside>
    <nav class="frame toolbar" data-testid="hud-toolbar" :aria-label="de.tools.label">
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        :data-testid="`tool-${tool.id}`"
        :aria-pressed="selection.tool === tool.id"
        :title="`${tool.label} (${tool.key})`"
        :aria-keyshortcuts="tool.key"
        :data-guide="steps.guide === `tool-${tool.id}` ? 'next' : undefined"
        @click="pickTool(selection, store.state as GameState, tool.id)"
      >
        {{ tool.label }}
      </button>
    </nav>
    <FpsMeter v-if="view.fpsVisible" />
    <HelpOverlay v-if="view.helpOpen" />
    <SavePanel v-if="savePanel.open" />
  </div>
</template>

<style scoped>
.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  --hud-bg: rgb(43 36 32 / 92%);
  --hud-fg: #f5ece0;
  color: var(--hud-fg);
}
.frame {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  background: var(--hud-bg);
  border-radius: 12px;
}
.top-bar {
  top: 16px;
  left: 16px;
  right: 16px;
  height: 60px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  font-size: 20px;
}
.name {
  display: flex;
  flex-direction: column;
}
.name small {
  font-size: 12px;
  opacity: 0.8;
}
.time {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 0 auto;
  font-size: 15px;
  font-weight: 600;
}
.chip {
  padding: 8px 16px;
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  white-space: nowrap;
}
.stats {
  display: flex;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}
.save-button {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  margin-left: 12px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.save-button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
.help-button {
  flex: none;
  width: 44px;
  height: 44px;
  margin-left: 12px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-size: 20px;
  font-weight: 600;
  cursor: pointer;
}
.help-button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
.speeds {
  display: flex;
  gap: 4px;
  padding: 2px;
  border-radius: 10px;
  background: rgb(255 255 255 / 8%);
}
.speeds button {
  min-width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.speeds button[aria-pressed='true'] {
  background: #f2c48d;
  color: #2b2420;
}
.speeds button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
/* With the phase chip the bar holds about 1130 px of content, so the stats hang below it as a tab. */
@media (max-width: 1279px) {
  .stats {
    position: absolute;
    top: 100%;
    right: 12px;
    padding: 1px 8px;
    border-radius: 0 0 6px 6px;
    background: var(--hud-bg);
    font-size: 11px;
    line-height: 13px;
  }
  .stats .chip {
    padding: 0;
    background: none;
    font-size: 14px;
  }
  /* Only the icon fits, the aria-label keeps the name. */
  .save-button {
    width: 36px;
    margin-left: 2px;
    padding: 0;
    justify-content: center;
  }
  .save-button span {
    display: none;
  }
}
@media (max-width: 760px) {
  .top-bar {
    padding: 0 4px;
  }
  .name strong {
    display: none;
  }
  /* The bar has no room for the seed, so it hangs below the bar as a tab. */
  .name small {
    position: absolute;
    top: 100%;
    left: 12px;
    padding: 1px 8px;
    border-radius: 0 0 6px 6px;
    background: var(--hud-bg);
    font-size: 11px;
    line-height: 13px;
    white-space: nowrap;
  }
  .time {
    gap: 4px;
  }
  .chip {
    padding: 8px 4px;
    font-size: 14px;
  }
  /* Day and hour in two lines, so a long day number still fits. */
  .clock {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 6px;
    font-size: 12px;
    line-height: 15px;
  }
  .clock-separator {
    display: none;
  }
  .speeds {
    gap: 0;
  }
  /* Six speed buttons, the save and the help button must fit beside the clock. */
  .speeds button {
    min-width: 22px;
    padding: 0 1px;
  }
  .help-button {
    width: 36px;
    margin-left: 2px;
  }
}
/* The stats tab must fit beside the seed tab, so it drops the progress and uses the seed tab font. */
@media (max-width: 480px) {
  .phase-progress {
    display: none;
  }
  .stats {
    padding: 1px 6px;
  }
  .stats .chip {
    font-size: 11px;
  }
}
.left-panel {
  top: 92px;
  left: 16px;
  width: min(300px, calc(50vw - 24px));
  height: 220px;
}
.right-panel {
  top: 92px;
  right: 16px;
  width: min(330px, calc(50vw - 24px));
  max-height: 480px;
  overflow-y: auto;
}
@media (max-width: 1279px) {
  /* Room for the event tab below the stats tab. */
  .left-panel {
    top: 108px;
    height: 204px;
  }
  .right-panel {
    top: 108px;
    max-height: 464px;
  }
}
.toolbar {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(820px, calc(100vw - 32px));
  height: 82px;
  display: flex;
  gap: 8px;
  padding: 8px;
}
.toolbar button {
  flex: 1 0 0;
  min-width: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.toolbar button[aria-pressed='true'] {
  background: #f2c48d;
  color: #2b2420;
}
.toolbar button[data-guide='next'] {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
.toolbar button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
@media (max-width: 480px) {
  /* Nine tools do not fit in one row, so they use two rows of five and four. */
  .toolbar {
    height: auto;
    flex-wrap: wrap;
    gap: 4px;
  }
  /* "Auswählen" is the longest label. It fits at 390 px only with a smaller font and no padding. */
  .toolbar button {
    flex-basis: calc(20% - 4px);
    height: 44px;
    padding: 0;
    font-size: 12px;
  }
}
@media (max-width: 380px) {
  .toolbar button {
    font-size: 11px;
  }
}
</style>
