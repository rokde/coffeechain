import { createPinia } from 'pinia'
import { Vector2, Vector3, type Camera, type Scene } from 'three'
import { createApp, watch } from 'vue'
import raw from '../config/balance.json'
import { loadBalance } from '../config/balance.schema'
import { advance } from './app/loop'
import { selectParcel } from './app/market'
import { useSelectionStore } from './app/selection'
import { useGameStore } from './app/store'
import { useViewStore } from './app/view'
import { createCamera } from './render/camera'
import { createFieldMarks, fieldAnchors } from './render/fields'
import { loadModel, MODEL_IDS } from './render/models'
import { createPlants, plantsKey } from './render/plants'
import { createOutline, createOutlines, pickParcel } from './render/picking'
import { createProps, syncTrees } from './render/props'
import { applyOverlay } from './render/overlays'
import { createScene } from './render/scene'
import { createTerrain } from './render/terrain'
import { balance } from './sim/balance'
import type { FarmState } from './sim/farm/parcels'
import type { GameState } from './sim/state'
import { step } from './sim/time/time'
import Hud from './ui/Hud.vue'
import de from './ui/i18n/de.json'

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

// Debug view at /?debug=models: all models in one row, each with an HTML label.
function showModelRow(scene: Scene, camera: Camera) {
  // Run the row along the screen x axis of the start camera (yaw 45°), between the HUD panels.
  const spacing = new Vector3(1, 0, -1).setLength(1.9)
  const labels = MODEL_IDS.map((id, i) => {
    // Lift a little above the water plane, so that the path tiles (top at y = -0.05) stay visible.
    const at = spacing
      .clone()
      .multiplyScalar(i - (MODEL_IDS.length - 1) / 2)
      .setY(0.1)
    void loadModel(id).then((model) => {
      model.position.copy(at)
      scene.add(model)
    })
    const label = document.createElement('div')
    label.dataset.testid = `model-${id}`
    label.textContent = id
    label.style.cssText =
      'position:fixed;transform:translate(-50%,0);font:10px monospace;background:#fffc;padding:1px 4px'
    document.body.append(label)
    return { label, at: at.clone().setY(-0.5) }
  })
  return () => {
    for (const { label, at } of labels) {
      const p = at.clone().project(camera)
      label.style.left = `${((p.x + 1) / 2) * window.innerWidth}px`
      label.style.top = `${((1 - p.y) / 2) * window.innerHeight}px`
    }
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

  const debugModels = new URLSearchParams(location.search).get('debug') === 'models'
  let placeLabels = () => {}
  if (debugModels) {
    view.camera.zoom = 2
    view.camera.updateProjectionMatrix()
    placeLabels = showModelRow(scene, view.camera)
  }

  const pinia = createPinia()
  const store = useGameStore(pinia)
  // The model row lies at the origin, so the debug view has no terrain.
  // createTerrain only reads the world, so the cast of the readonly snapshot is safe.
  if (!debugModels) {
    const world = store.state.world as GameState['world']
    const terrain = createTerrain(world)
    const outline = createOutline(terrain, world.size)
    const outlines = createOutlines(terrain, world.size)
    const plants = createPlants(world)
    scene.add(terrain, outline.line, outlines.line, plants.group)
    watch(
      () => plantsKey(store.state.farm.plants, store.state.time.hour),
      () => plants.show(store.state.farm.plants, store.state.time.hour),
      { immediate: true },
    )
    const viewStore = useViewStore(pinia)
    watch(
      () => viewStore.overlay,
      (mode) => applyOverlay(terrain, world, mode),
    )
    createProps(world, store.state.props as GameState['props'], loadModel)
      .then((props) => {
        scene.add(props)
        watch(
          () => store.state.props.trees,
          (trees) => syncTrees(props, trees),
          // A buy can happen while the models load.
          { immediate: true },
        )
        canvas.dataset.props = 'ready'
      })
      .catch((error: unknown) => console.error('Props did not load:', error))
    const marks = createFieldMarks(terrain)
    scene.add(marks.mesh)
    // Field labels lie above the canvas and below the HUD.
    const fieldLayer = document.createElement('div')
    fieldLayer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden'
    document.querySelector('#hud')!.before(fieldLayer)
    let fieldLabels: { label: HTMLElement; at: Vector3 }[] = []
    watch(
      () => store.state.farm,
      (farm) => {
        // show and fieldAnchors only read the farm, so the cast of the readonly snapshot is safe.
        marks.show(farm as FarmState)
        fieldLabels = fieldAnchors(world, farm as FarmState).map(({ name, position }) => {
          const label = document.createElement('div')
          label.dataset.testid = `field-label-${name}`
          label.textContent = de.field.label.replace('{name}', name)
          label.style.cssText =
            'position:absolute;transform:translate(-50%,calc(-100% - 8px));white-space:nowrap;' +
            'padding:5px 12px;border-radius:999px;background:rgb(43 36 32 / 92%);color:#f5ece0;' +
            'font:600 14px system-ui,sans-serif'
          return { label, at: new Vector3(position.x, position.y, position.z) }
        })
        fieldLayer.replaceChildren(...fieldLabels.map(({ label }) => label))
      },
      { immediate: true },
    )
    placeLabels = () => {
      for (const { label, at } of fieldLabels) {
        const p = at.clone().project(view.camera)
        label.style.left = `${((p.x + 1) / 2) * window.innerWidth}px`
        label.style.top = `${((1 - p.y) / 2) * window.innerHeight}px`
      }
    }
    const selection = useSelectionStore(pinia)
    watch(() => (selection.tool === 'select' ? selection.parcel : null), outline.show)
    watch(() => selection.parcels, outlines.show)
    // Select tool: a click on the terrain selects its parcel, a click beside it clears the selection.
    // Parcel and plant tool: a click on the terrain adds or removes its parcel.
    canvas.addEventListener('click', (event) => {
      const ndc = new Vector2(
        (event.offsetX / canvas.clientWidth) * 2 - 1,
        1 - (event.offsetY / canvas.clientHeight) * 2,
      )
      const parcel = pickParcel(ndc, view.camera, terrain, world.size)
      // toggle only reads the state, so the cast of the readonly snapshot is safe.
      if (selection.tool === 'parcel' || selection.tool === 'plant') {
        if (parcel) selection.toggle(store.state as GameState, parcel)
      } else selectParcel(selection, store.state as GameState, parcel)
    })
  }
  const { realSecondsPerGameDay, ticksPerGameDay } = balance().time
  const msPerTick = (realSecondsPerGameDay * 1000) / ticksPerGameDay
  let carryMs = 0
  let last: number | undefined

  // setAnimationLoop runs on requestAnimationFrame.
  renderer.setAnimationLoop((now) => {
    const due = advance(carryMs, now - (last ?? now), store.state.time.speed, msPerTick)
    last = now
    carryMs = due.carryMs
    // step never changes its input, so the cast of the readonly snapshot is safe.
    let state = store.state as GameState
    for (let i = 0; i < due.ticks; i++) state = step(state)
    if (due.ticks > 0) store.replace(state)
    renderer.render(scene, view.camera)
    placeLabels()
  })
  createApp(Hud).use(pinia).mount('#hud')
}

if (configIsValid()) start()
