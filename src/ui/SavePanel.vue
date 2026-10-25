<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { slots, useSavePanelStore, type SlotStatus } from '../app/savePanel'
import { formatDate } from './date'
import de from './i18n/de.json'

const t = de.savePanel
const panel = useSavePanelStore()
onMounted(panel.refresh)
// A closed panel opens again without the confirm step.
onUnmounted(() => (panel.confirmNewGame = false))

function statusText(status: SlotStatus | undefined) {
  if (status === undefined) return ''
  if (typeof status === 'object') return formatDate(status.day)
  return t[status]
}
const messageText = computed(() => {
  const m = panel.message
  if (m === null) return null
  return m.key === 'invalidPending' ? t.invalidPending : t[m.key].replace('{reason}', m.reason)
})

// On a narrow window the panel scrolls, so the message can be out of view.
const messageBox = useTemplateRef('messageBox')
watch(messageText, async (text) => {
  if (text === null) return
  await nextTick()
  messageBox.value?.scrollIntoView({ block: 'nearest' })
})

// The swapped buttons remove the focused button, so move the focus to the new step.
const newGameButton = useTemplateRef('newGameButton')
const cancelButton = useTemplateRef('cancelButton')
async function askNewGame(ask: boolean) {
  panel.confirmNewGame = ask
  await nextTick()
  // The cancel button gets the focus, so Enter does not overwrite the game.
  ;(ask ? cancelButton : newGameButton).value?.focus()
}
</script>

<template>
  <div class="backdrop">
    <section
      class="saves"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-heading"
      data-testid="save-panel"
    >
      <header>
        <h2 id="save-heading">{{ t.heading }}</h2>
        <button
          type="button"
          class="close"
          data-testid="save-panel-close"
          :aria-label="t.close"
          @click="panel.open = false"
        >
          ×
        </button>
      </header>
      <p
        v-if="messageText"
        ref="messageBox"
        class="message"
        role="alert"
        data-testid="save-panel-message"
      >
        {{ messageText }}
      </p>
      <ul>
        <li v-for="(slot, i) in slots" :key="slot" :data-testid="`save-${slot}`">
          <span class="name">{{ t.slot.replace('{n}', String(i + 1)) }}</span>
          <span class="status" data-testid="save-slot-status">{{
            statusText(panel.status[slot])
          }}</span>
          <button type="button" data-testid="save-slot-save" @click="panel.save(slot)">
            {{ t.save }}
          </button>
          <button
            type="button"
            data-testid="save-slot-load"
            :disabled="typeof panel.status[slot] !== 'object'"
            @click="panel.load(slot)"
          >
            {{ t.load }}
          </button>
        </li>
        <li data-testid="save-autosave">
          <span class="name">{{ t.autosave }}</span>
          <span class="status" data-testid="save-slot-status">{{
            statusText(panel.status.autosave)
          }}</span>
          <button
            type="button"
            data-testid="save-slot-load"
            :disabled="typeof panel.status.autosave !== 'object'"
            @click="panel.load('autosave')"
          >
            {{ t.load }}
          </button>
        </li>
      </ul>
      <div
        class="new-game"
        :role="panel.confirmNewGame ? 'group' : undefined"
        aria-labelledby="new-game-text"
      >
        <template v-if="panel.confirmNewGame">
          <p id="new-game-text">{{ t.newGameConfirm }}</p>
          <button
            type="button"
            class="danger"
            data-testid="save-new-game-confirm"
            @click="panel.newGame()"
          >
            {{ t.newGameYes }}
          </button>
          <button
            ref="cancelButton"
            type="button"
            data-testid="save-new-game-cancel"
            @click="askNewGame(false)"
          >
            {{ t.cancel }}
          </button>
        </template>
        <button
          v-else
          ref="newGameButton"
          type="button"
          data-testid="save-new-game"
          @click="askNewGame(true)"
        >
          {{ t.newGame }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: rgb(0 0 0 / 50%);
  pointer-events: auto;
}
.saves {
  box-sizing: border-box;
  width: min(440px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 16px 20px;
  border-radius: 12px;
  background: var(--hud-bg);
  color: var(--hud-fg);
  font-size: 14px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 20px;
}
.message {
  margin: 12px 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgb(242 196 141 / 15%);
  color: #f2c48d;
  overflow-wrap: anywhere;
}
ul {
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid rgb(255 255 255 / 10%);
}
.new-game {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid rgb(255 255 255 / 10%);
}
.new-game p {
  flex-basis: 100%;
  margin: 0;
}
.danger {
  color: #f2c48d;
  box-shadow: inset 0 0 0 1px #f2c48d;
}
.name {
  font-weight: 600;
}
.status {
  flex: 1;
  opacity: 0.8;
  white-space: nowrap;
}
button {
  height: 44px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: rgb(255 255 255 / 8%);
  color: inherit;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
.close {
  width: 44px;
  padding: 0;
  font-size: 22px;
  font-weight: normal;
}
button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: 2px;
}
</style>
