<script setup lang="ts">
import { computed } from 'vue'
import { listSlots, useSaveListStore } from '../app/saveList'
import type { Slot } from '../app/savePanel'
import { useStartScreenStore } from '../app/startScreen'
import type { GameState } from '../sim/state'
import { ago } from './ago'
import { formatDate } from './date'
import de from './i18n/de.json'
import { formatMoney } from './money'

const emit = defineEmits<{ play: [state: GameState] }>()
const list = useSaveListStore()
const screen = useStartScreenStore()
const now = Date.now()

const label = (slot: Slot) =>
  slot === 'autosave' ? de.savePanel.autosave : de.savePanel.slot.replace('{n}', slot.slice(-1))
const cards = computed(() =>
  listSlots.map((slot) => ({ slot, entry: list.entries[slot] ?? 'empty' })),
)
const visible = computed(() => cards.value.some((c) => c.entry !== 'empty'))

// The same once-only guard as "Weiterspielen", so a second click starts no second game.
async function pick(state: GameState) {
  const started = await screen.play(state)
  if (started) emit('play', started)
}
</script>

<template>
  <aside v-if="visible" class="saves" data-testid="save-list" aria-labelledby="save-list-heading">
    <h2 id="save-list-heading">{{ de.startScreen.saves }}</h2>
    <ul>
      <li v-for="{ slot, entry } in cards" :key="slot">
        <button
          v-if="typeof entry === 'object'"
          type="button"
          class="card"
          :data-testid="`save-card-${slot}`"
          @click="pick(entry.state)"
        >
          <span class="name">{{ label(slot) }}</span>
          <span class="date">{{ formatDate(entry.state.time.day) }}</span>
          <span class="facts"
            >{{ de.world.seed.replace('{seed}', String(entry.state.world.seed)) }} ·
            {{ formatMoney(entry.state.money) }}</span
          >
          <span v-if="entry.savedAt !== null" class="ago">{{ ago(entry.savedAt, now) }}</span>
        </button>
        <div v-else class="card off" :data-testid="`save-card-${slot}`">
          <span class="name">{{ label(slot) }}</span>
          <span class="facts">{{ de.savePanel[entry] }}</span>
        </div>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.saves {
  position: absolute;
  top: 32px;
  right: 32px;
  box-sizing: border-box;
  width: 340px;
  max-height: calc(100% - 64px);
  padding: 24px;
  overflow-y: auto;
  border-radius: 16px;
  background: rgb(43 36 32 / 92%);
  pointer-events: auto;
}
h2 {
  margin: 0 0 12px;
  color: #f2c48d;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.card {
  display: grid;
  align-content: start;
  gap: 2px;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 12px 16px;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px;
  background: rgb(255 255 255 / 6%);
  color: inherit;
  font: inherit;
  text-align: left;
}
button.card {
  cursor: pointer;
}
button.card:hover {
  border-color: #f2c48d;
}
button.card:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
.off {
  opacity: 0.6;
}
.name {
  color: #f2c48d;
  font-size: 12px;
  font-weight: 700;
}
.date {
  font-size: 17px;
  font-weight: 700;
}
.facts,
.ago {
  font-size: 13px;
  opacity: 0.8;
}
/* The start screen panel is 320 px wide here, so the list sits right of it at the bottom. */
@media (max-width: 1100px) {
  .saves {
    top: auto;
    right: 16px;
    bottom: 16px;
    left: 352px;
    width: auto;
    max-height: calc(100% - 32px);
    padding: 16px;
  }
  ul {
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  }
}
/* The start screen panel fills the bottom here, so the list sits at the top. */
@media (max-width: 640px) {
  .saves {
    top: 12px;
    right: 12px;
    bottom: auto;
    left: 12px;
    max-height: 40%;
  }
  ul {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }
  .card {
    padding: 8px 12px;
  }
  .date {
    font-size: 15px;
  }
}
</style>
