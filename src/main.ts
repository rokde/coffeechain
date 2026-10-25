import { createPinia } from 'pinia'
import { Group, Vector2, Vector3, type Camera, type Material, type Mesh, type Scene } from 'three'
import { createApp, watch } from 'vue'
import raw from '../config/balance.json'
import { loadBalance } from '../config/balance.schema'
import { installAutosave } from './app/autosave'
import { advance } from './app/loop'
import { selectParcel } from './app/market'
import { isClick, strokeParcel } from './app/brush'
import { addMarks, isBrushTool, markParcel, parcelRect, useSelectionStore } from './app/selection'
import { installDebugKeys } from './app/debugKeys'
import { fpsFromFrames } from './app/fps'
import { installHelpKeys } from './app/helpKeys'
import { installSpeedKeys } from './app/speedKeys'
import { installToolKeys } from './app/toolKeys'
import { skipResume, startState } from './app/resume'
import { setStartState, useGameStore } from './app/store'
import { useStartScreenStore } from './app/startScreen'
import { useViewStore } from './app/view'
import {
  CAMERA,
  createCamera,
  gestureZoomDelta,
  islandView,
  startView,
  wheelZoomDelta,
} from './render/camera'
import { createFieldMarks, FIELD_LABEL_STYLE, fieldAnchors, hoveredField } from './render/fields'
import { loadModel, MODEL_IDS } from './render/models'
import { createBuildings } from './render/buildings'
import { createPlants, plantsKey } from './render/plants'
import { createPath } from './render/path'
import { createOutline, createOutlines, pickParcel, type ParcelPos } from './render/picking'
import { createProps, syncTrees } from './render/props'
import { applyOverlay } from './render/overlays'
import { createScene } from './render/scene'
import { createTerrain } from './render/terrain'
import { balance } from './sim/balance'
import type { FarmState } from './sim/farm/parcels'
import type { GameState } from './sim/state'
import { msPerStep, step } from './sim/time/time'
import type { World } from './sim/world/types'
import Hud from './ui/Hud.vue'
import StartScreen from './ui/StartScreen.vue'
import de from './ui/i18n/de.json'
import { toolCursor } from './ui/toolCursor'

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

// The renderer, the scene and the camera. The start screen and the game share them.
function createStage() {
  const canvas = document.querySelector<HTMLCanvasElement>('#scene')!
  const { renderer, scene } = createScene(canvas)
  const view = createCamera(window.innerWidth / window.innerHeight, balance().world.size)

  const resize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight, false)
    view.resize(window.innerWidth / window.innerHeight)
  }
  resize()
  window.addEventListener('resize', resize)
  return { canvas, renderer, scene, view }
}
type Stage = ReturnType<typeof createStage>

// The start screen shows the island of the save or of the seed. It has no input on the scene.
function showStartScreen(stage: Stage, save: GameState | null) {
  const { canvas, renderer, scene, view } = stage
  let preview: { group: Group; owned: Mesh[]; world: World } | null = null
  const clear = () => {
    if (!preview) return
    scene.remove(preview.group)
    // The props share their geometry with the model cache, so only the terrain and the path free theirs.
    for (const mesh of preview.owned) {
      mesh.geometry.dispose()
      ;(mesh.material as Material).dispose()
    }
    preview = null
  }
  const show = (state: GameState) => {
    clear()
    const owned = [createTerrain(state.world), createPath(state.world, state.props.path)]
    const group = new Group().add(...owned)
    preview = { group, owned, world: state.world }
    scene.add(group)
    canvas.dataset.preview = String(state.world.seed)
    delete canvas.dataset.props
    createProps(state.world, state.props, loadModel)
      .then((props) => {
        if (preview?.group !== group) return
        group.add(props)
        canvas.dataset.props = 'ready'
      })
      .catch((error: unknown) => console.error('Props did not load:', error))
    aim()
  }
  // Fits the whole island into the screen part that the panel leaves free: right of it, or above it.
  const aim = () => {
    if (!preview) return
    const w = window.innerWidth
    const h = window.innerHeight
    const panel = document
      .querySelector('[data-testid="start-screen"] main')
      ?.getBoundingClientRect()
    const free = { left: 0, top: 0, width: w, height: h }
    if (panel && panel.width > w * 0.6) free.height = panel.top
    else if (panel) free.left = panel.right
    free.width = w - free.left
    // A margin keeps the coast off the screen edge and the panel edge.
    const fx = (0.9 * free.width) / w
    const fy = (0.9 * free.height) / h
    const { target, zoom } = islandView(preview.world, w / h, {
      left: -fx,
      right: fx,
      bottom: -fy,
      top: fy,
    })
    view.frame(target, zoom)
    // The preview can zoom out past the game limit, so a narrow screen shows the whole island.
    view.camera.zoom = zoom
    // The offset moves the screen centre to the centre of the free part.
    view.camera.setViewOffset(
      w,
      h,
      w / 2 - (free.left + free.width / 2),
      h / 2 - free.height / 2,
      w,
      h,
    )
  }
  renderer.setAnimationLoop(() => renderer.render(scene, view.camera))

  const pinia = createPinia()
  const screen = useStartScreenStore(pinia)
  screen.save = save
  // After the DOM update, so that aim reads the new panel size.
  const stop = watch(
    () => screen.preview,
    (state) => state && show(state),
    { immediate: true, flush: 'post' },
  )
  window.addEventListener('resize', aim)
  const app = createApp(StartScreen, {
    onPlay: (state: GameState) => {
      stop()
      window.removeEventListener('resize', aim)
      app.unmount()
      clear()
      view.camera.clearViewOffset()
      delete canvas.dataset.preview
      delete canvas.dataset.props
      play(stage, state)
    },
  })
  app.use(pinia).mount('#hud')
  aim()
}

function start({ canvas, renderer, scene, view }: Stage) {
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
  installAutosave(store)
  const viewStore = useViewStore(pinia)
  installHelpKeys(viewStore, useSelectionStore(pinia))
  installToolKeys(viewStore, useSelectionStore(pinia), store)
  installDebugKeys(viewStore)
  // The model row lies at the origin, so the debug view has no terrain.
  // createTerrain only reads the world, so the cast of the readonly snapshot is safe.
  if (!debugModels) {
    const world = store.state.world as GameState['world']
    const terrain = createTerrain(world)
    const outline = createOutline(terrain, world.size)
    const outlines = createOutlines(terrain, world.size)
    const plants = createPlants(world)
    const buildings = createBuildings(world)
    const worldProps = store.state.props as GameState['props']
    scene.add(
      terrain,
      createPath(world, worldProps.path),
      outline.line,
      outlines.line,
      plants.group,
      buildings.group,
    )
    const { target, zoom } = startView(world, worldProps, window.innerWidth / window.innerHeight)
    view.frame(target, zoom)
    // The anchor lies above the ground, so the camera centers the ground point behind it.
    watch(
      () => viewStore.focus,
      (to) => {
        if (!to) return
        const d = view.camera.getWorldDirection(new Vector3())
        const t = -to.y / d.y
        view.frame({ x: to.x + d.x * t, z: to.z + d.z * t }, view.camera.zoom)
      },
    )
    watch(
      () => plantsKey(store.state.farm.plants, store.state.time.day),
      () => plants.show(store.state.farm.plants, store.state.time.day),
      { immediate: true },
    )
    // A load reloads the page, so the immediate run also shows the loaded buildings.
    watch(
      () => store.state.buildings,
      (list) => {
        buildings.show(list)
        canvas.dataset.buildings = String(buildings.group.children.length)
      },
      { immediate: true },
    )
    watch(
      () => viewStore.overlay,
      (mode) => applyOverlay(terrain, world, mode),
    )
    createProps(world, worldProps, loadModel)
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
      () => [store.state.farm, store.state.buildings] as const,
      ([farm, built]) => {
        // show and fieldAnchors only read the farm, so the cast of the readonly snapshot is safe.
        marks.show(farm as FarmState)
        fieldLabels = fieldAnchors(world, farm as FarmState, built).map(
          ({ id, name, position }) => {
            const label = document.createElement('div')
            label.dataset.testid = `field-label-${name}`
            label.textContent = de.field.label.replace('{name}', name)
            label.style.cssText = FIELD_LABEL_STYLE
            return { id, label, at: new Vector3(position.x, position.y, position.z) }
          },
        )
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
    watch(
      () => selection.tool,
      (tool) => (canvas.style.cursor = toolCursor(tool)),
      { immediate: true },
    )
    // Select tool: a click on the terrain selects and marks its parcel, a click beside it clears both.
    canvas.addEventListener('click', (event) => {
      if (isBrushTool(selection.tool) || dragged) return
      const parcel = pickParcel(ndcOf(event), view.camera, terrain, world.size)
      // selectParcel only reads the state, so the cast of the readonly snapshot is safe.
      selectParcel(selection, store.state as GameState, parcel)
      if (selection.tool === 'select')
        selection.parcels = parcel ? markParcel(selection.parcels, parcel, event.shiftKey) : []
    })
    // Select tool: a left drag marks the grid rectangle from the pressed parcel to the parcel under the pointer.
    let marking: { x: number; y: number; from: ParcelPos | null; base: ParcelPos[] } | null = null
    // True after a drag, so that the click at the end of the drag does not change the marks.
    let dragged = false
    const mark = (event: PointerEvent) => {
      if (!marking || selection.tool !== 'select') return
      if (!dragged && isClick(event.clientX - marking.x, event.clientY - marking.y)) return
      dragged = true
      const to = pickParcel(ndcOf(event), view.camera, terrain, world.size)
      if (marking.from && to)
        selection.parcels = addMarks(marking.base, parcelRect(marking.from, to))
    }
    // Brush tools: a left press acts on the parcel under the pointer, a left drag paints over more parcels.
    let stroke: Set<number> | null = null
    let rightDown: { x: number; y: number } | null = null
    const brush = (event: PointerEvent) => {
      const { tool } = selection
      if (!stroke || !isBrushTool(tool)) return
      const parcel = pickParcel(ndcOf(event), view.camera, terrain, world.size)
      if (!parcel) return
      // strokeParcel only reads the state, so the cast of the readonly snapshot is safe.
      const result = strokeParcel(stroke, store.state as GameState, tool, selection.variety, parcel)
      if (result === undefined) return
      if (typeof result === 'string') selection.note = result
      else {
        store.dispatch(result)
        selection.note = null
      }
    }
    canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 2) rightDown = { x: event.clientX, y: event.clientY }
      if (event.button === 0 && selection.tool === 'select') {
        dragged = false
        marking = {
          x: event.clientX,
          y: event.clientY,
          from: pickParcel(ndcOf(event), view.camera, terrain, world.size),
          base: event.shiftKey ? selection.parcels : [],
        }
        canvas.setPointerCapture(event.pointerId)
      }
      if (event.button !== 0 || !isBrushTool(selection.tool)) return
      stroke = new Set()
      // The capture sends the release to the canvas, also over the HUD, so no old stroke stays.
      canvas.setPointerCapture(event.pointerId)
      brush(event)
    })
    canvas.addEventListener('pointermove', (event) => {
      if (event.buttons & 1) {
        brush(event)
        mark(event)
      }
    })
    canvas.addEventListener('pointerup', (event) => {
      stroke = null
      marking = null
      if (event.button !== 2 || !rightDown) return
      // A right-click puts down the tool and clears the marks. The end of a right-drag pan does not.
      if (isClick(event.clientX - rightDown.x, event.clientY - rightDown.y)) {
        if (isBrushTool(selection.tool)) selection.tool = 'select'
        selection.parcels = []
      }
      rightDown = null
    })
    canvas.addEventListener('pointercancel', () => {
      stroke = null
      marking = null
      rightDown = null
    })
    canvas.addEventListener('lostpointercapture', () => {
      stroke = null
      marking = null
    })
  }
  let carryMs = 0
  let last: number | undefined
  let lastCameraKey = ''
  // About one second of frames at 60 fps.
  const frameTimes: number[] = []

  // setAnimationLoop runs on requestAnimationFrame.
  renderer.setAnimationLoop((now) => {
    const frameMs = now - (last ?? now)
    const due = advance(carryMs, frameMs, store.state.time.speed, msPerStep(store.state.time.stage))
    last = now
    frameTimes.push(frameMs)
    if (frameTimes.length > 60) frameTimes.shift()
    if (viewStore.fpsVisible) viewStore.fps = fpsFromFrames(frameTimes)
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

function play(stage: Stage, state: GameState | null) {
  // The store and the terrain need the first world, so set it before the rest.
  setStartState(state)
  try {
    start(stage)
  } catch (error) {
    // shortcut: a reload, not a clean restart in the same page; upgrade if start gets a teardown.
    if (state === null) throw error
    console.error('Start with the loaded game failed, the start screen opens', error)
    skipResume()
  }
}

async function boot() {
  const { state, menu } = await startState(location.search)
  const stage = createStage()
  if (menu) showStartScreen(stage, state)
  else play(stage, state)
}

if (configIsValid()) void boot()
