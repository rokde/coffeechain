<script setup lang="ts">
import { computed } from 'vue'
import { useSelectionStore } from '../app/selection'
import { useGameStore } from '../app/store'
import { balance } from '../sim/balance'
import { clock } from '../sim/time/time'
import de from './i18n/de.json'
import { formatMoney } from './money'
import MarketPanel from './MarketPanel.vue'
import ParcelInspector from './ParcelInspector.vue'
import OverlayPanel from './OverlayPanel.vue'
import ParcelTool from './ParcelTool.vue'
import PlantTool from './PlantTool.vue'
import { tools } from './toolbar'

const store = useGameStore()
const selection = useSelectionStore()
const speeds = balance().time.speeds
const clockText = computed(() => {
  const { day, hourOfDay } = clock(store.state.time.hour)
  return de.time.clock
    .replace('{day}', String(day))
    .replace('{hour}', String(hourOfDay).padStart(2, '0'))
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
        <span class="chip" data-testid="clock">{{ clockText }}</span>
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
      <span class="chip money" data-testid="money">{{ formatMoney(store.state.money) }}</span>
    </header>
    <aside class="frame left-panel" data-testid="hud-left-panel" />
    <OverlayPanel />
    <aside class="frame right-panel" data-testid="hud-right-panel">
      <ParcelTool v-if="selection.tool === 'parcel'" />
      <PlantTool v-else-if="selection.tool === 'plant'" />
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
        @click="selection.tool = tool.id"
      >
        {{ tool.label }}
      </button>
    </nav>
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
.money {
  font-size: 15px;
  font-weight: 600;
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
@media (max-width: 480px) {
  .top-bar {
    padding: 0 12px;
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
  /* Same tab as the seed, on the right. */
  .chip.money {
    position: absolute;
    top: 100%;
    right: 12px;
    padding: 1px 8px;
    border-radius: 0 0 6px 6px;
    background: var(--hud-bg);
    font-size: 11px;
    line-height: 13px;
  }
  .time {
    gap: 8px;
  }
  .chip {
    padding: 8px 10px;
  }
  .speeds {
    gap: 2px;
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
  height: 480px;
}
.toolbar {
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(730px, calc(100vw - 32px));
  height: 82px;
  display: flex;
  gap: 8px;
  padding: 8px;
}
.toolbar button {
  min-width: 96px;
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
.toolbar button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
@media (max-width: 480px) {
  /* Four tools do not fit at 96 px each. */
  .toolbar button {
    flex: 1;
    min-width: 0;
  }
}
</style>
