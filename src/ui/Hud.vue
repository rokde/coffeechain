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
import FieldList from './FieldList.vue'
import FloatingCoins from './FloatingCoins.vue'
import FirstSteps from './FirstSteps.vue'
import FarmTool from './FarmTool.vue'
import FpsMeter from './FpsMeter.vue'
import HelpOverlay from './HelpOverlay.vue'
import MarketPanel from './MarketPanel.vue'
import MessagePanel from './MessagePanel.vue'
import MoneyToasts from './MoneyToasts.vue'
import BuildTool from './BuildTool.vue'
import ParcelInspector from './ParcelInspector.vue'
import OverlayPanel from './OverlayPanel.vue'
import ParcelTool from './ParcelTool.vue'
import PlantTool from './PlantTool.vue'
import SavePanel from './SavePanel.vue'
import { overlays, tools } from './toolbar'

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
const storageText = computed(() => {
  const full = de.storage
    .replace('{used}', String(storageUsed((store.state as GameState).storage)))
    .replace('{capacity}', String(storageCapacity(store.state as GameState)))
  // The word before the numbers. At 480 px or less only the crate icon names the value.
  const word = de.storage.slice(0, de.storage.indexOf('{used}'))
  return { full, word, numbers: full.slice(word.length) }
})
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
        <div class="money-group" data-testid="money-group">
          <span class="money" data-testid="money"
            ><svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
              <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5" />
              <circle
                cx="8"
                cy="8"
                r="3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              /></svg
            >{{ formatMoney(store.state.money) }}</span
          >
          <span
            data-testid="storage"
            :title="storageText.full"
            :aria-label="storageText.full"
            role="group"
            ><svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
              <path
                d="M2 5h12v9H2z M2 5l1.5-3h9L14 5 M6 8h4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linejoin="round"
              /></svg
            ><span
              ><span class="storage-word">{{ storageText.word }}</span
              >{{ storageText.numbers }}</span
            ></span
          >
        </div>
        <span
          class="chip"
          data-testid="phase"
          :title="phaseText.hint"
          :aria-label="phaseText.label"
          role="group"
          >{{ phaseText.name }}
          <span v-if="phaseText.progress" class="phase-progress">{{
            phaseText.progress
          }}</span></span
        >
      </div>
      <EventChips />
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
      <FirstSteps v-if="steps.open && steps.current.next !== null" />
      <template v-else><FieldList /><MessagePanel /></template>
    </aside>
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
      <div class="overlays" role="group" :aria-label="de.overlay.label">
        <button
          v-for="overlay in overlays"
          :key="overlay.id"
          type="button"
          :data-testid="`overlay-${overlay.id}`"
          :aria-pressed="view.overlay === overlay.id"
          :title="`${overlay.title} (${overlay.key})`"
          :aria-keyshortcuts="overlay.key"
          :data-guide="steps.guide === `overlay-${overlay.id}` ? 'next' : undefined"
          @click="view.toggle(overlay.id)"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
            <path
              :d="overlay.icon"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
          <span>{{ overlay.label }}</span>
        </button>
      </div>
      <OverlayPanel />
    </nav>
    <MoneyToasts />
    <FloatingCoins />
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
  padding: 0 16px;
  font-size: 20px;
}
.name {
  display: flex;
  flex-direction: column;
}
.name strong {
  font-size: 18px;
}
.name small {
  font-size: 12px;
  opacity: 0.8;
}
.time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  padding: 0 8px;
  font-size: 15px;
  font-weight: 600;
}
.chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgb(255 255 255 / 8%);
  white-space: nowrap;
}
.stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 600;
}
.money-group {
  display: flex;
  gap: 12px;
  font-size: 20px;
  font-weight: 700;
}
.money-group > span {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.save-button {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  margin-left: 8px;
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
  margin-left: 8px;
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
/* The bar holds about 1200 px of content, so the money group and the phase get a second row. */
@media (max-width: 1279px) {
  .top-bar {
    height: 94px;
    flex-wrap: wrap;
    align-content: space-between;
    padding: 8px 16px 6px;
  }
  .stats {
    order: 1;
    flex-basis: 100%;
    justify-content: center;
    height: 32px;
  }
  .stats .chip {
    padding: 4px 12px;
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
    padding: 8px 4px 6px;
  }
  .name strong {
    display: none;
  }
  /* The bar has no room for the seed, so it hangs below the bar as a tab. */
  .name small {
    position: absolute;
    top: calc(100% + 4px);
    left: 12px;
    padding: 1px 8px;
    border-radius: 6px;
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
/* The second row must fit the money group, so the phase drops the progress and the storage its word. */
@media (max-width: 480px) {
  .top-bar {
    height: auto;
    min-height: 94px;
  }
  /* shortcut: a wrapped row makes the bar taller than the panel tops expect, only for very large values. */
  .stats {
    flex-wrap: wrap;
    height: auto;
    min-height: 32px;
  }
  .phase-progress,
  .storage-word {
    display: none;
  }
  .stats,
  .money-group {
    gap: 6px;
  }
  .money-group > span {
    gap: 4px;
  }
  .stats .chip {
    padding: 4px;
  }
}
/* The height limit keeps the panel above the overlay panel at top 328px. */
.left-panel {
  --left-max: 220px;
  top: 92px;
  left: 16px;
  width: min(300px, calc(50vw - 24px));
  max-height: var(--left-max);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.right-panel {
  top: 92px;
  right: 16px;
  width: min(330px, calc(50vw - 24px));
  max-height: 480px;
  overflow-y: auto;
}
/* The panels start 4 px below the event tab. The right panel keeps its bottom edge, the overlay panel moves down. */
@media (max-width: 1279px) {
  .left-panel {
    --left-max: 204px;
    top: 134px;
  }
  .right-panel {
    top: 134px;
    max-height: 438px;
  }
}
/* Room for a second line of the event tab. */
@media (max-width: 480px) {
  .left-panel {
    top: 148px;
  }
  .right-panel {
    top: 148px;
    max-height: 424px;
  }
}
.toolbar {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(1000px, calc(100vw - 32px));
  height: 82px;
  display: flex;
  gap: 8px;
  padding: 8px;
}
.toolbar button {
  flex: 1 0 0;
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
.overlays {
  flex: 2 0 0;
  display: flex;
  gap: 8px;
  padding-left: 8px;
  border-left: 1px solid rgb(255 255 255 / 25%);
}
.overlays button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
/* Eleven buttons in one row need a smaller font. "Auswählen" keeps its full width. */
@media (max-width: 900px) {
  .toolbar button {
    padding: 0;
    font-size: 12px;
  }
}
@media (max-width: 640px) {
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
  /* The overlay toggles take their own row below the tools. */
  .overlays {
    flex-basis: 100%;
    gap: 4px;
    padding: 4px 0 0;
    border-left: 0;
    border-top: 1px solid rgb(255 255 255 / 25%);
  }
  .overlays button {
    flex: 1 0 0;
    flex-direction: row;
    gap: 6px;
  }
}
@media (max-width: 380px) {
  .toolbar button {
    font-size: 11px;
  }
}
</style>
