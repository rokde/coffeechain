<script setup lang="ts">
import { computed } from 'vue'
import { useViewStore } from '../app/view'
import { SOIL_COLORS, ZONE_OVERLAY_COLORS } from '../render/overlays'
import de from './i18n/de.json'

const view = useViewStore()
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
  <section
    v-if="legend.length"
    class="overlay-panel"
    data-testid="hud-overlay-panel"
    :aria-label="de.overlay[view.overlay as 'soil' | 'zone']"
  >
    <ul class="legend" data-testid="overlay-legend">
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
/* The parent toolbar places the legend 8 px above its own top edge. */
.overlay-panel {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  max-width: 100%;
  box-sizing: border-box;
  pointer-events: auto;
  background: var(--hud-bg);
  border-radius: 12px;
  padding: 8px 14px;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.swatch {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 4px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.8;
}
</style>
