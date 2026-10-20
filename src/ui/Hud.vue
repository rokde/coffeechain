<script setup lang="ts">
import de from './i18n/de.json'
import { tools } from './toolbar'
</script>

<template>
  <div class="hud">
    <header class="frame top-bar" data-testid="hud-top-bar">
      <strong>{{ de.game.name }}</strong>
    </header>
    <aside class="frame left-panel" data-testid="hud-left-panel" />
    <aside class="frame right-panel" data-testid="hud-right-panel" />
    <nav class="frame toolbar" data-testid="hud-toolbar">
      <button v-for="tool in tools" :key="tool.id" type="button">{{ tool.label }}</button>
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
</style>
