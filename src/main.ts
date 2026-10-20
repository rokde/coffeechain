import { createPinia } from 'pinia'
import { Vector2, Vector3, type Camera, type Scene } from 'three'
import { createApp, watch } from 'vue'
import raw from '../config/balance.json'
import { loadBalance } from '../config/balance.schema'
import { advance } from './app/loop'
import { selectParcel } from './app/market'
import { isFarmTool, useSelectionStore } from './app/selection'
import { installHelpKeys } from './app/helpKeys'
import { installSpeedKeys } from './app/speedKeys'
import { useGameStore } from './app/store'
import { useViewStore } from './app/view'
import { CAMERA, createCamera, gestureZoomDelta, wheelZoomDelta } from './render/camera'
import { createFieldMarks, FIELD_LABEL_STYLE, fieldAnchors, hoveredField } from './render/fields'
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
  const view = createCamera(window.innerWidth / window.innerHeight, balance().world.size)

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    view.resize(window.innerWidth / window.innerHeight)
  }
  resize()
  window.addEventListener('resize', resize)

  const held = new Set<string>()
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
    const t = event.target
    if (
      t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      (t as HTMLElement).isContentEditable
    )
      return
    const key = event.key.toLowerCase()
    if (key === 'q') view.rotate(-1)
    if (key === 'e') view.rotate(1)
    if (key.length === 1 && 'wasd'.includes(key)) held.add(key)
  })
  window.addEventListener('keyup', (event) => held.delete(event.key.toLowerCase()))
  // A key release outside the window never arrives.
  window.addEventListener('blur', () => held.clear())

  const ndcOf = (event: MouseEvent) =>
    new Vector2(
      (event.offsetX / canvas.clientWidth) * 2 - 1,
      1 - (event.offsetY / canvas.clientHeight) * 2,
    )
  // Chromium sends a trackpad pinch as wheel events with ctrlKey. preventDefault stops the page zoom.
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      view.zoomAt(ndcOf(event), wheelZoomDelta(event.deltaY, event.ctrlKey))
    },
    { passive: false },
  )
  // WebKit (Tauri on macOS) sends a trackpad pinch as gesture events. TypeScript has no type for them.
  type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number }
  let lastScale = 1
  canvas.addEventListener('gesturestart', (event) => {
    event.preventDefault()
    lastScale = 1
  })
  canvas.addEventListener('gesturechange', (event) => {
    event.preventDefault()
    const { scale, clientX, clientY } = event as GestureEvent
    const rect = canvas.getBoundingClientRect()
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((clientY - rect.top) / rect.height) * 2,
    )
    view.zoomAt(ndc, gestureZoomDelta(scale, lastScale))
    lastScale = scale
  })
  canvas.addEventListener('gestureend', (event) => event.preventDefault())
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())
  let drag: { x: number; y: number } | null = null
  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 2) return
    drag = { x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
  })
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return
    view.pan(event.clientX - drag.x, event.clientY - drag.y, canvas.clientHeight)
    drag = { x: event.clientX, y: event.clientY }
  })
  const endDrag = (event: PointerEvent) => {
    if (!drag) return
    drag = null
    canvas.releasePointerCapture(event.pointerId)
  }
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)

  const debugModels = new URLSearchParams(location.search).get('debug') === 'models'
  let placeLabels = () => {}
  // Checks the hover again for the last pointer position.
  let rehover = () => {}
  if (debugModels) {
    view.camera.zoom = 2
    view.camera.updateProjectionMatrix()
    placeLabels = showModelRow(scene, view.camera)
  }

  const pinia = createPinia()
  const store = useGameStore(pinia)
  installSpeedKeys(store)
  installHelpKeys(useViewStore(pinia))
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
    let fieldLabels: { id: number; label: HTMLElement; at: Vector3 }[] = []
    // The field whose label is faded. It survives a rebuild of the labels under a still mouse.
    let fadedField: number | null = null
    const fadeLabels = () => {
      for (const { id, label } of fieldLabels) label.style.opacity = id === fadedField ? '0' : '1'
    }
    watch(
      () => store.state.farm,
      (farm) => {
        // show and fieldAnchors only read the farm, so the cast of the readonly snapshot is safe.
        marks.show(farm as FarmState)
        fieldLabels = fieldAnchors(world, farm as FarmState).map(({ id, name, position }) => {
          const label = document.createElement('div')
          label.dataset.testid = `field-label-${name}`
          label.textContent = de.field.label.replace('{name}', name)
          label.style.cssText = FIELD_LABEL_STYLE
          return { id, label, at: new Vector3(position.x, position.y, position.z) }
        })
        fadeLabels()
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
    // The label of the field under the mouse fades out, so the player sees the field.
    let pointer: { ndc: Vector2; x: number; y: number } | null = null
    rehover = () => {
      if (!pointer) return
      const parcel = pickParcel(pointer.ndc, view.camera, terrain, world.size)
      const boxes = fieldLabels.map(({ id, label }) => ({ id, box: label.getBoundingClientRect() }))
      fadedField = hoveredField(parcel, store.state.farm as FarmState, world.size, pointer, boxes)
      fadeLabels()
    }
    canvas.addEventListener('pointermove', (event) => {
      pointer = { ndc: ndcOf(event), x: event.clientX, y: event.clientY }
      rehover()
    })
    canvas.addEventListener('pointerleave', () => {
      pointer = null
      fadedField = null
      fadeLabels()
    })
    const selection = useSelectionStore(pinia)
    watch(() => (selection.tool === 'select' ? selection.parcel : null), outline.show)
    watch(() => selection.parcels, outlines.show)
    // Select tool: a click on the terrain selects its parcel, a click beside it clears the selection.
    // Parcel, plant and farm tools: a click on the terrain adds or removes its parcel.
    canvas.addEventListener('click', (event) => {
      const parcel = pickParcel(ndcOf(event), view.camera, terrain, world.size)
      // toggle only reads the state, so the cast of the readonly snapshot is safe.
      const { tool } = selection
      if (tool === 'parcel' || tool === 'plant' || isFarmTool(tool)) {
        if (parcel) selection.toggle(store.state as GameState, parcel)
      } else selectParcel(selection, store.state as GameState, parcel)
    })
  }
  const { realSecondsPerGameDay, ticksPerGameDay } = balance().time
  const msPerTick = (realSecondsPerGameDay * 1000) / ticksPerGameDay
  let carryMs = 0
  let last: number | undefined
  let lastCameraKey = ''

  // setAnimationLoop runs on requestAnimationFrame.
  renderer.setAnimationLoop((now) => {
    const frameMs = now - (last ?? now)
    const due = advance(carryMs, frameMs, store.state.time.speed, msPerTick)
    last = now
    const right = Number(held.has('d')) - Number(held.has('a'))
    const up = Number(held.has('w')) - Number(held.has('s'))
    if (right || up) {
      const dist = (CAMERA.keySpeed * frameMs) / 1000 / view.camera.zoom
      view.panBy(right * dist, up * dist)
    }
    carryMs = due.carryMs
    // step never changes its input, so the cast of the readonly snapshot is safe.
    let state = store.state as GameState
    for (let i = 0; i < due.ticks; i++) state = step(state)
    if (due.ticks > 0) store.replace(state)
    renderer.render(scene, view.camera)
    placeLabels()
    // A zoom, pan or rotation moves the ground under a still mouse.
    const cameraKey = `${view.camera.position.toArray().join()},${view.camera.zoom}`
    if (cameraKey !== lastCameraKey) rehover()
    lastCameraKey = cameraKey
  })
  createApp(Hud).use(pinia).mount('#hud')
}

if (configIsValid()) start()
