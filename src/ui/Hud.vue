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
import { dateParts } from './date'
import de from './i18n/de.json'
import { formatMoney } from './money'
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
import StoragePanel from './StoragePanel.vue'
import { overlays, tools } from './toolbar'

const store = useGameStore()
const selection = useSelectionStore()
const steps = useFirstStepsStore()
const view = useViewStore()
const savePanel = useSavePanelStore()
const speeds = balance().time.speeds
const dateText = computed(() => dateParts(store.state.time.day))
const moneyText = computed(() => formatMoney(store.state.money))
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
          ><span>{{ dateText[0] }}</span
          ><span class="clock-separator">{{ de.time.separator }}</span
          ><span>{{ dateText[1] }}</span></span
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
        <span class="time-unit" data-testid="time-unit">{{
          de.time.units[store.state.time.stage]
        }}</span>
      </div>
      <div class="stats">
        <div class="money-group" data-testid="money-group">
          <span
            class="money"
            :class="{ 'money-long': moneyText.length > 12 }"
            data-testid="money"
            :title="moneyText"
            :aria-label="moneyText"
            role="group"
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
            >{{ moneyText }}</span
          >
          <button
            type="button"
            class="storage-button"
            data-testid="storage"
            :title="storageText.full"
            :aria-label="storageText.full"
            :aria-pressed="view.storageOpen"
            aria-keyshortcuts="I"
            @click="view.toggleStorage()"
          >
            <svg viewBox="0 0 16 16" width="22" height="22" aria-hidden="true">
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
            >
          </button>
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
    <StoragePanel v-if="view.storageOpen" />
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
  color: var(--hud-fg);
  font-variant-numeric: tabular-nums;
}
/* Quiet chrome: one warm surface with a hairline, the island carries the colour. */
.frame {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  background: var(--hud-bg);
  box-shadow: inset 0 0 0 1px var(--line);
  border-radius: 12px;
}
button {
  transition:
    background-color 140ms var(--ease),
    color 140ms var(--ease);
}
button:active {
  transform: scale(0.98);
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
  gap: 2px;
}
.name strong {
  font-size: 17px;
  font-weight: 600;
}
.name small {
  font-size: 12px;
  color: var(--fg-3);
}
.time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 auto;
  padding: 0 8px;
  font-size: 15px;
  font-weight: 500;
}
.chip {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--raised);
  white-space: nowrap;
}
.stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  font-weight: 500;
}
.money-group {
  display: flex;
  gap: 16px;
  font-size: 20px;
  font-weight: 600;
}
.money-group > span,
.storage-button {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.storage-button {
  height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.storage-button:hover {
  background: var(--raised);
}
.storage-button[aria-pressed='true'] {
  background: var(--raised-hover);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.money-group svg {
  color: var(--fg-3);
}
.phase-progress {
  color: var(--fg-2);
}
.save-button,
.help-button {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  margin-left: 8px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: var(--raised);
  color: inherit;
  font: inherit;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.help-button {
  width: 44px;
  padding: 0;
  font-size: 18px;
}
.save-button:hover,
.help-button:hover {
  background: var(--raised-hover);
}
.save-button:focus-visible,
.help-button:focus-visible,
.storage-button:focus-visible,
.speeds button:focus-visible,
.toolbar button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.speeds {
  display: flex;
  gap: 2px;
  padding: 2px;
  border-radius: 10px;
  background: var(--raised);
}
.speeds button {
  min-width: 44px;
  height: 44px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--fg-2);
  font: inherit;
  cursor: pointer;
}
.speeds button:hover {
  color: var(--hud-fg);
}
.speeds button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
.time-unit {
  font-size: 12px;
  font-weight: 400;
  color: var(--fg-3);
}
/* Below 1440 px a long date does not fit in one line, so date and year get two lines. */
@media (max-width: 1439px) {
  .clock {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 8px;
    font-size: 12px;
    line-height: 16px;
  }
  .clock-separator {
    display: none;
  }
}
/* The bar holds about 1200 px of content, so the money group and the phase get a second row. */
@media (max-width: 1279px) {
  .top-bar {
    height: 94px;
    flex-wrap: wrap;
    align-content: space-between;
    padding: 8px 16px;
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
    width: 44px;
    padding: 0;
  }
  .save-button span {
    display: none;
  }
}
/* The left panel holds the first steps or the fields, the right panel the active tool. */
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
@media (max-width: 1279px) {
  .left-panel {
    --left-max: 204px;
    top: 126px;
  }
  .right-panel {
    top: 126px;
    max-height: 446px;
  }
}
.toolbar {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(1000px, calc(100vw - 32px));
  height: 80px;
  display: flex;
  gap: 4px;
  padding: 8px;
}
.toolbar button {
  flex: 1 0 0;
  padding: 0 4px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--fg-2);
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.toolbar button:hover {
  background: var(--raised);
  color: var(--hud-fg);
}
.toolbar button[aria-pressed='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
.toolbar button[data-guide='next'] {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  color: var(--hud-fg);
}
.overlays {
  flex: 2 0 0;
  display: flex;
  gap: 4px;
  margin-left: 4px;
  padding-left: 8px;
  border-left: 1px solid var(--line);
}
.overlays button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
@media (max-width: 900px) {
  .toolbar button {
    padding: 0;
    font-size: 12px;
  }
}

/*
 * Portrait phones and narrow windows. The HUD becomes one column in reading order:
 * top bar, first steps or fields, the island, the active tool as a sheet, the toolbar.
 * Everything sits in the flow, so panels never overlap and the island stays visible between them.
 */
@media (max-width: 760px) {
  .hud {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  /* Flush with the screen edges: every pixel goes to the island and the panels. */
  .hud > .frame {
    position: relative;
    inset: auto;
    transform: none;
    width: auto;
    flex: 0 0 auto;
    border-radius: 0;
  }
  .hud > .left-panel {
    border-radius: 0 0 12px 12px;
  }
  .hud > .right-panel {
    border-radius: 12px 12px 0 0;
  }
  /* The left panel keeps its content up to a third of the screen, the sheet takes what is left. */
  .hud > .right-panel {
    flex: 0 1 auto;
    min-height: 0;
  }
  /* Row 1: clock, speeds, save, help. Row 2: money, storage, phase. Row 3: seed and time unit. */
  .top-bar {
    height: auto;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      'clock speeds save help'
      'stats stats stats stats'
      'seed seed unit unit';
    align-items: center;
    gap: 4px;
    padding: max(8px, env(safe-area-inset-top)) 8px 8px;
  }
  .time,
  .name {
    display: contents;
  }
  .name strong {
    display: none;
  }
  .clock {
    grid-area: clock;
  }
  .speeds {
    grid-area: speeds;
    gap: 0;
  }
  .speeds button {
    flex: 1 0 0;
    min-width: 0;
    padding: 0;
  }
  .save-button {
    grid-area: save;
    margin: 0;
  }
  .help-button {
    grid-area: help;
    margin: 0;
  }
  .stats {
    grid-area: stats;
    order: 0;
    height: 36px;
    border-top: 1px solid var(--line);
    padding-top: 4px;
  }
  .name small {
    grid-area: seed;
    font-size: 11px;
    line-height: 16px;
  }
  .time-unit {
    grid-area: unit;
    justify-self: end;
    font-size: 11px;
    line-height: 16px;
  }
  .left-panel {
    --left-max: 32%;
  }
  /* The sheet sits on the toolbar. The island shows above it. */
  .right-panel {
    max-height: none;
    margin-top: auto;
  }
  .toolbar {
    height: auto;
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 4px;
    padding: 6px 6px max(6px, env(safe-area-inset-bottom));
  }
  .toolbar button {
    height: 56px;
  }
  /* The legend joins the flow above the buttons, so it never covers the sheet. */
  .toolbar :deep(.overlay-panel) {
    position: static;
    order: -1;
    grid-column: 1 / -1;
    max-width: none;
    padding: 4px 6px 8px;
    background: none;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
  }
}
/* Ten buttons in a 5 × 2 grid: eight tools, then the two overlay toggles. */
@media (max-width: 640px) {
  .toolbar {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
  .toolbar button {
    height: 44px;
    padding: 0;
    font-size: 12px;
  }
  .overlays {
    grid-column: span 2;
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin: 0;
    padding: 0;
    border: 0;
  }
  .overlays button {
    flex-direction: row;
    gap: 4px;
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .overlays svg {
    width: 16px;
    height: 16px;
  }
}
/* The second row must fit the money group, so the phase drops the progress and the storage its word. */
@media (max-width: 480px) {
  .phase-progress,
  .storage-word {
    display: none;
  }
  .stats,
  .money-group {
    gap: 8px;
  }
  .money-group > span,
  .storage-button {
    gap: 4px;
  }
  .storage-button {
    height: 36px;
    padding: 0 8px;
  }
  /* Values wider than 12 characters shrink, so the row stays on one line. */
  .money-long {
    font-size: 14px;
  }
  .money-long svg {
    width: 16px;
    height: 16px;
  }
  .stats .chip {
    padding: 4px 8px;
  }
}
@media (max-width: 380px) {
  .clock {
    padding: 4px;
    font-size: 11px;
  }
  .toolbar button {
    font-size: 11px;
  }
}
</style>
