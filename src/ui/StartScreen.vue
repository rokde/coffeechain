<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { useStartScreenStore } from '../app/startScreen'
import type { GameState } from '../sim/state'
import { islandFacts } from '../sim/world/facts'
import { formatDate } from './date'
import de from './i18n/de.json'
import { formatMoney } from './money'

const emit = defineEmits<{ play: [state: GameState] }>()
const t = de.startScreen
const screen = useStartScreenStore()
const zoneIds = ['tiefland', 'hochland', 'hochlandKuehl'] as const
const facts = computed(() => (screen.preview ? islandFacts(screen.preview.world) : null))
const hut = computed(() => {
  const h = facts.value?.hut
  if (!h) return ''
  const i = de.inspector
  return t.hut
    .replace('{zone}', i.zones[h.zone])
    .replace('{parcel}', i.position.replace('{x}', String(h.x)).replace('{y}', String(h.y)))
    .replace('{soil}', i.soilClasses[h.soilClass])
})

async function play() {
  const state = await screen.play()
  if (state) emit('play', state)
}

// The swapped buttons remove the focused button, so move the focus to the new step.
const newGameButton = useTemplateRef('newGameButton')
const cancelButton = useTemplateRef('cancelButton')
const seedInput = useTemplateRef('seedInput')
async function askNewGame(ask: boolean) {
  screen.confirmNewGame = ask
  await nextTick()
  // The cancel button gets the focus, so Enter does not drop the game.
  ;(ask ? cancelButton : newGameButton).value?.focus()
}
async function confirmNewGame() {
  screen.confirmNewGame = false
  screen.newGame = true
  await nextTick()
  seedInput.value?.focus()
}
async function back() {
  screen.newGame = false
  await nextTick()
  newGameButton.value?.focus()
}
</script>

<template>
  <div class="start" data-testid="start-screen">
    <main class="panel">
      <header class="logo">
        <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
          <ellipse cx="16" cy="16" rx="10" ry="13" transform="rotate(30 16 16)" fill="#f2c48d" />
          <path
            d="M20 5c-6 6 0 16-8 22"
            fill="none"
            stroke="#2b2420"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <div>
          <h1>{{ de.game.name }}</h1>
          <p>{{ t.subtitle }}</p>
        </div>
      </header>

      <template v-if="screen.welcome && screen.save">
        <section class="body">
          <h2>{{ t.welcome }}</h2>
          <p class="date" data-testid="start-save-date">{{ formatDate(screen.save.time.day) }}</p>
          <p class="facts">
            <span data-testid="start-save-world">{{
              de.world.seed.replace('{seed}', String(screen.save.world.seed))
            }}</span>
            ·
            <span data-testid="start-save-money">{{ formatMoney(screen.save.money) }}</span>
          </p>
        </section>
        <div
          class="actions"
          :role="screen.confirmNewGame ? 'group' : undefined"
          :aria-labelledby="screen.confirmNewGame ? 'start-confirm-text' : undefined"
        >
          <template v-if="screen.confirmNewGame">
            <p id="start-confirm-text">{{ de.savePanel.newGameConfirm }}</p>
            <button
              type="button"
              class="danger"
              data-testid="start-new-game-confirm"
              @click="confirmNewGame"
            >
              {{ de.savePanel.newGameYes }}
            </button>
            <button
              ref="cancelButton"
              type="button"
              data-testid="start-new-game-cancel"
              @click="askNewGame(false)"
            >
              {{ de.savePanel.cancel }}
            </button>
          </template>
          <template v-else>
            <button type="button" class="primary" data-testid="start-continue" @click="play">
              <svg viewBox="0 0 10 10" width="12" height="12" aria-hidden="true">
                <path d="M2 1l7 4-7 4z" fill="currentColor" />
              </svg>
              {{ t.continue }}
            </button>
            <button
              ref="newGameButton"
              type="button"
              data-testid="start-new-game"
              @click="askNewGame(true)"
            >
              {{ t.newGame }}
            </button>
          </template>
        </div>
      </template>

      <form v-else class="new" @submit.prevent="play">
        <section class="body">
          <h2>{{ t.island }}</h2>
          <label for="start-seed">{{ t.seed }}</label>
          <div class="seed">
            <input
              id="start-seed"
              ref="seedInput"
              v-model="screen.seedText"
              data-testid="start-seed"
              inputmode="numeric"
              autocomplete="off"
              maxlength="10"
              :aria-invalid="screen.seed === null"
              aria-describedby="start-seed-hint"
            />
            <button
              type="button"
              class="reroll"
              data-testid="start-reroll"
              :aria-label="t.reroll"
              :title="t.reroll"
              @click="screen.reroll()"
            >
              <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
                <path
                  d="M13 8a5 5 0 1 1-1.5-3.6 M13 2v3h-3"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
          <p id="start-seed-hint" class="hint" :class="{ invalid: screen.seed === null }">
            {{ t.seedHint }}
          </p>
          <template v-if="facts">
            <ul class="zones" :aria-label="t.zoneShares">
              <li v-for="id in zoneIds" :key="id" :data-testid="`start-zone-${id}`">
                {{
                  t.zoneShare
                    .replace('{zone}', de.inspector.zones[id])
                    .replace('{pct}', String(facts.shares[id]))
                }}
              </li>
            </ul>
            <p class="hut" data-testid="start-hut">{{ hut }}</p>
          </template>
        </section>
        <div class="actions">
          <button
            type="submit"
            class="primary"
            data-testid="start-play"
            :disabled="screen.seed === null"
          >
            {{ t.play }} <span aria-hidden="true">→</span>
          </button>
          <button v-if="screen.save" type="button" data-testid="start-back" @click="back">
            {{ t.back }}
          </button>
        </div>
      </form>
    </main>
  </div>
</template>

<style scoped>
.start {
  position: fixed;
  inset: 0;
  pointer-events: none;
  color: #f5ece0;
}
.panel {
  position: absolute;
  top: 32px;
  bottom: 32px;
  left: 32px;
  box-sizing: border-box;
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 32px;
  overflow-y: auto;
  border-radius: 16px;
  background: rgb(43 36 32 / 92%);
  pointer-events: auto;
}
.logo {
  display: flex;
  align-items: center;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 28px;
}
.logo p {
  margin: 2px 0 0;
  font-size: 13px;
  opacity: 0.8;
}
h2 {
  margin: 0 0 12px;
  color: #f2c48d;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.new {
  display: contents;
}
.body {
  flex: 1;
}
.date {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  line-height: 1.2;
}
.facts {
  margin: 8px 0 0;
  font-size: 15px;
  opacity: 0.8;
}
label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  opacity: 0.8;
}
.seed {
  display: flex;
  gap: 12px;
}
input {
  flex: 1;
  min-width: 0;
  height: 52px;
  box-sizing: border-box;
  padding: 0 16px;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 10px;
  background: rgb(0 0 0 / 25%);
  color: inherit;
  font: inherit;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.05em;
}
input[aria-invalid='true'] {
  border-color: #f2c48d;
}
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  opacity: 0.8;
}
.hint.invalid {
  color: #f2c48d;
  opacity: 1;
}
.zones {
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.hut {
  margin: 12px 0 0;
  padding: 12px 14px;
  border-radius: 10px;
  background: rgb(0 0 0 / 25%);
  font-size: 14px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.actions p {
  margin: 0;
}
button {
  height: 52px;
  padding: 0 16px;
  border: 1px solid rgb(255 255 255 / 25%);
  border-radius: 10px;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
}
.primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  background: #f2c48d;
  color: #2b2420;
}
.primary:disabled {
  opacity: 0.4;
  cursor: default;
}
.danger {
  color: #f2c48d;
  border-color: #f2c48d;
}
.reroll {
  flex: none;
  width: 52px;
  padding: 0;
  background: rgb(255 255 255 / 8%);
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
/* The panel leaves more room for the island preview on a medium window. */
@media (max-width: 1100px) {
  .panel {
    top: 16px;
    bottom: 16px;
    left: 16px;
    width: 320px;
    padding: 24px;
  }
}
/* On a narrow window the panel fills the width below the island preview. */
@media (max-width: 640px) {
  .panel {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
    max-height: calc(100% - 24px);
    gap: 16px;
    padding: 20px;
  }
  .body {
    flex: none;
  }
  .date {
    font-size: 28px;
  }
}
</style>
