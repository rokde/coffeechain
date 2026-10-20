<script setup lang="ts">
import { computed } from 'vue'
import { useFirstStepsStore } from '../app/firstSteps'
import { useViewStore } from '../app/view'
import { SOIL_COLORS, ZONE_OVERLAY_COLORS } from '../render/overlays'
import de from './i18n/de.json'

const view = useViewStore()
const steps = useFirstStepsStore()
const modes = ['soil', 'zone'] as const
const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`
const legend = computed(() => {
  if (view.overlay === 'soil')
    return Object.entries(SOIL_COLORS).map(([id, color]) => ({
      name: de.inspector.soilClasses[id as keyof typeof SOIL_COLORS],
      color: hex(color),
    }))
  if (view.overlay === 'zone')
    return Object.entries(ZONE_OVERLAY_COLORS).map(([id, color]) => ({
      name: de.inspector.zones[id as keyof typeof ZONE_OVERLAY_COLORS],
      color: hex(color),
    }))
  return []
})
</script>

<template>
  <section class="overlay-panel" data-testid="hud-overlay-panel" :aria-label="de.overlay.label">
    <button
      v-for="mode in modes"
      :key="mode"
      type="button"
      role="switch"
      :data-testid="`overlay-${mode}`"
      :aria-checked="view.overlay === mode"
      :data-guide="steps.guide === `overlay-${mode}` ? 'next' : undefined"
      @click="view.toggle(mode)"
    >
      <span>{{ de.overlay[mode] }}</span>
      <span class="track" aria-hidden="true"><span class="thumb" /></span>
    </button>
    <ul v-if="legend.length" class="legend" data-testid="overlay-legend">
      <li v-for="item in legend" :key="item.name">
        <span class="swatch" :style="{ background: item.color }" aria-hidden="true" />{{
          item.name
        }}
      </li>
    </ul>
    <p v-if="view.overlay === 'soil'" class="hint">{{ de.overlay.soilHint }}</p>
  </section>
</template>

<style scoped>
.overlay-panel {
  position: absolute;
  box-sizing: border-box;
  pointer-events: auto;
  background: var(--hud-bg);
  border-radius: 12px;
  top: 328px;
  left: 16px;
  width: min(300px, calc(50vw - 24px));
  padding: 10px 18px;
}
button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
button[data-guide='next'] {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
  border-radius: 6px;
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
  border-radius: 6px;
}
.track {
  flex: none;
  position: relative;
  width: 52px;
  height: 28px;
  border-radius: 999px;
  background: rgb(255 255 255 / 20%);
  transition: background 0.15s;
}
.thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}
button[aria-checked='true'] .track {
  background: #8bc34a;
}
button[aria-checked='true'] .thumb {
  transform: translateX(24px);
}
.legend {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  margin: 8px 0 4px;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.swatch {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
@media (max-width: 480px) {
  .overlay-panel {
    padding: 10px 12px;
  }
  button {
    gap: 6px;
    font-size: 13px;
  }
  .track {
    width: 46px;
  }
  button[aria-checked='true'] .thumb {
    transform: translateX(18px);
  }
  .legend {
    grid-template-columns: 1fr;
  }
}
.hint {
  margin: 8px 0 4px;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.8;
}
</style>
