import { createPinia } from 'pinia'
import { createApp } from 'vue'
import raw from '../config/balance.json'
import { loadBalance } from '../config/balance.schema'
import { advance } from './app/loop'
import { useGameStore } from './app/store'
import { createCamera } from './render/camera'
import { createScene } from './render/scene'
import { balance } from './sim/balance'
import type { GameState } from './sim/state'
import { step } from './sim/time/time'
import Hud from './ui/Hud.vue'

function configIsValid(): boolean {
  try {
    loadBalance(raw)
    return true
  } catch (error) {
    const pre = document.createElement('pre')
    pre.dataset.testid = 'config-error'
    pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:24px;background:#fff;color:#b00'
    pre.textContent = `Fehler in config/balance.json:\n\n${error instanceof Error ? error.message : String(error)}`
    document.body.append(pre)
    return false
  }
}

function start() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
  const { renderer, scene } = createScene(canvas)
  const view = createCamera(window.innerWidth / window.innerHeight)

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    view.resize(window.innerWidth / window.innerHeight)
  }
  resize()
  window.addEventListener('resize', resize)

  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    const key = event.key.toLowerCase()
    if (key === 'q') view.rotate(-1)
    if (key === 'e') view.rotate(1)
  })

  const pinia = createPinia()
  const store = useGameStore(pinia)
  const { realSecondsPerGameDay, ticksPerGameDay } = balance().time
  const msPerTick = (realSecondsPerGameDay * 1000) / ticksPerGameDay
  let carryMs = 0
  let last: number | undefined

  // setAnimationLoop runs on requestAnimationFrame.
  renderer.setAnimationLoop((now) => {
    const due = advance(carryMs, now - (last ?? now), store.state.time.speed, msPerTick)
    last = now
    carryMs = due.carryMs
    let state = store.state as GameState
    for (let i = 0; i < due.ticks; i++) state = step(state)
    if (due.ticks > 0) store.replace(state)
    renderer.render(scene, view.camera)
  })
  createApp(Hud).use(pinia).mount('#hud')
}

if (configIsValid()) start()
