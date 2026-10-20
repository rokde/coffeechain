<script setup lang="ts">
import { computed } from 'vue'
import { useFirstStepsStore } from '../app/firstSteps'
import de from './i18n/de.json'

const t = de.firstSteps
const store = useFirstStepsStore()
const hint = computed(() => (store.current.hint ? t.hints[store.current.hint] : null))
</script>

<template>
  <section class="steps" data-testid="first-steps">
    <header>
      <h2>{{ t.heading }}</h2>
      <button
        type="button"
        data-testid="first-steps-close"
        :aria-label="t.close"
        @click="store.open = false"
      >
        ×
      </button>
    </header>
    <p v-if="hint" class="hint" data-testid="first-steps-hint">{{ hint }}</p>
    <ol>
      <li
        v-for="step in store.current.steps"
        :key="step.id"
        :data-testid="`first-step-${step.id}`"
        :data-done="step.done"
      >
        <span class="check" aria-hidden="true">{{ step.done ? '✓' : '' }}</span>
        <span class="text">{{ t.steps[step.id] }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.steps {
  box-sizing: border-box;
  height: 100%;
  overflow-y: auto;
  padding: 10px 20px;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #f2c48d;
}
header button {
  width: 44px;
  height: 44px;
  margin: -8px -12px -8px 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-size: 22px;
  cursor: pointer;
}
header button:focus-visible {
  outline: 2px solid #f2c48d;
  outline-offset: -2px;
  border-radius: 8px;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  line-height: 1.3;
}
li {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.check {
  flex: none;
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 1.5px solid rgb(255 255 255 / 50%);
  border-radius: 4px;
  font-size: 12px;
  line-height: 13px;
  text-align: center;
}
li[data-done='true'] .check {
  background: #8bc34a;
  border-color: #8bc34a;
  color: #2b2420;
}
li[data-done='true'] .text {
  text-decoration: line-through;
  opacity: 0.6;
}
.hint {
  margin: 4px 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: #f2c48d;
}
@media (max-width: 480px) {
  h2 {
    font-size: 11px;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
}
</style>
