import { createPinia } from 'pinia'
import { createApp } from 'vue'
import raw from '../config/balance.json'
import { loadBalance } from '../config/balance.schema'
import { createCamera } from './render/camera'
import { createScene } from './render/scene'
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
    const key = event.key.toLowerCase()
    if (key === 'q') view.rotate(-1)
    if (key === 'e') view.rotate(1)
  })

  renderer.setAnimationLoop(() => renderer.render(scene, view.camera))
  createApp(Hud).use(createPinia()).mount('#hud')
}

if (configIsValid()) start()
