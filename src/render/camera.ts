import { OrthographicCamera, Plane, Raycaster, Vector3, type Vector2 } from 'three'
import { balance } from '../sim/balance'
import type { WorldProps } from '../sim/world/props'
import type { World } from '../sim/world/types'
import { cornerY, parcelCenter } from './surface'

export const START_YAW = 45
export const PITCH = 35
const DISTANCE = 100
const VIEW_HEIGHT = 40

// Render settings, not game balancing.
export const CAMERA = {
  minZoom: 0.5,
  maxZoom: 6,
  // Zoom factor per wheel delta unit: one mouse wheel notch (deltaY 100) zooms by e^0.2.
  wheelFactor: 0.002,
  // A Chromium pinch (wheel with ctrlKey) sends small deltas of about 1 to 10.
  pinchFactor: 0.02,
  // Ground units per second at zoom 1.
  keySpeed: 20,
}

// The start view keeps the start area inside this part of the screen (NDC), away from the HUD.
export const START_FRAME = { x: 0.9, y: 0.75 }

// Turns the yaw (degrees) by 90° per step. E is +1, Q is -1. Result is in [0, 360).
export function rotateYaw(yaw: number, steps: number): number {
  return (((yaw + steps * 90) % 360) + 360) % 360
}

export function clampZoom(zoom: number): number {
  return Math.min(CAMERA.maxZoom, Math.max(CAMERA.minZoom, zoom))
}

// A negative deltaY (wheel up, pinch out) zooms in.
export function nextZoom(zoom: number, deltaY: number): number {
  return clampZoom(zoom * Math.exp(-deltaY * CAMERA.wheelFactor))
}

// Turns a wheel event into the deltaY that nextZoom expects.
export function wheelZoomDelta(deltaY: number, ctrlKey: boolean): number {
  return ctrlKey ? (deltaY * CAMERA.pinchFactor) / CAMERA.wheelFactor : deltaY
}

// Turns a WebKit gesture scale step into a deltaY, so that the zoom changes by scale / lastScale.
export function gestureZoomDelta(scale: number, lastScale: number): number {
  return -Math.log(scale / lastScale) / CAMERA.wheelFactor
}

export function clampTarget(target: { x: number; z: number }, size: number) {
  const clamp = (v: number) => Math.min(size / 2, Math.max(-size / 2, v))
  return { x: clamp(target.x), z: clamp(target.z) }
}

// Turns a screen direction (right, up) into a ground direction (x, z) for the yaw in degrees.
export function groundDirection(yaw: number, right: number, up: number) {
  const y = (yaw * Math.PI) / 180
  return {
    x: right * Math.cos(y) - up * Math.sin(y),
    z: -right * Math.sin(y) - up * Math.cos(y),
  }
}

// Frames the hut, the market, the path and the start reach square for START_YAW.
export function startView(world: World, props: WorldProps, aspect: number) {
  const n = world.size
  const { startReach } = balance().world
  const lo = (v: number) => Math.max(0, v - startReach)
  const hi = (v: number) => Math.min(n, v + startReach + 1)
  const corners = [
    [lo(world.start.x), lo(world.start.y)],
    [hi(world.start.x), lo(world.start.y)],
    [lo(world.start.x), hi(world.start.y)],
    [hi(world.start.x), hi(world.start.y)],
  ].map(([cx, cz]) => ({ x: cx! - n / 2, y: cornerY(world, cx!, cz!), z: cz! - n / 2 }))
  const points = [props.hut, props.market, ...props.path]
    .map((p) => parcelCenter(world, p.x, p.y))
    .concat(corners)
  const xs = points.map((p) => p.x)
  const zs = points.map((p) => p.z)
  const target = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  }
  // The screen right and screen up axes of the camera in world space.
  const y = (START_YAW * Math.PI) / 180
  const p = (PITCH * Math.PI) / 180
  const right = { x: Math.cos(y), z: -Math.sin(y) }
  const up = { x: -Math.sin(p) * Math.sin(y), y: Math.cos(p), z: -Math.sin(p) * Math.cos(y) }
  let zoom = Infinity
  for (const q of points) {
    const dx = q.x - target.x
    const dz = q.z - target.z
    const sx = Math.abs(dx * right.x + dz * right.z)
    const sy = Math.abs(dx * up.x + q.y * up.y + dz * up.z)
    zoom = Math.min(
      zoom,
      (START_FRAME.x * VIEW_HEIGHT * aspect) / 2 / sx,
      (START_FRAME.y * VIEW_HEIGHT) / 2 / sy,
    )
  }
  return { target, zoom: clampZoom(zoom) }
}

const ground = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()

export function createCamera(aspect: number, worldSize: number) {
  const camera = new OrthographicCamera()
  const target = new Vector3()
  let yaw = START_YAW

  function place() {
    const y = (yaw * Math.PI) / 180
    const p = (PITCH * Math.PI) / 180
    const flat = DISTANCE * Math.cos(p)
    camera.position.set(flat * Math.sin(y), DISTANCE * Math.sin(p), flat * Math.cos(y)).add(target)
    camera.lookAt(target)
    // Raycasts read matrixWorld before the next render.
    camera.updateMatrixWorld()
  }

  function resize(newAspect: number) {
    camera.left = (-VIEW_HEIGHT * newAspect) / 2
    camera.right = (VIEW_HEIGHT * newAspect) / 2
    camera.top = VIEW_HEIGHT / 2
    camera.bottom = -VIEW_HEIGHT / 2
    camera.near = 0.1
    camera.far = DISTANCE * 3
    camera.updateProjectionMatrix()
  }

  function rotate(steps: number) {
    yaw = rotateYaw(yaw, steps)
    place()
  }

  // Moves the target by ground units toward screen right and screen up.
  function panBy(right: number, up: number) {
    const d = groundDirection(yaw, right, up)
    const { x, z } = clampTarget({ x: target.x + d.x, z: target.z + d.z }, worldSize)
    target.set(x, 0, z)
    place()
  }

  // Drags the ground with the pointer. heightPx is the canvas height in CSS pixels.
  function pan(dxPx: number, dyPx: number, heightPx: number) {
    const unitsPerPx = VIEW_HEIGHT / camera.zoom / heightPx
    // A screen-up step in view space covers a longer distance on the tilted ground.
    panBy(-dxPx * unitsPerPx, (dyPx * unitsPerPx) / Math.sin((PITCH * Math.PI) / 180))
  }

  function groundAt(ndc: Vector2) {
    raycaster.setFromCamera(ndc, camera)
    return raycaster.ray.intersectPlane(ground, new Vector3())
  }

  // Zooms toward the cursor: the ground point under ndc stays under ndc.
  function zoomAt(ndc: Vector2, deltaY: number) {
    const zoom = nextZoom(camera.zoom, deltaY)
    if (zoom === camera.zoom) return
    const before = groundAt(ndc)
    camera.zoom = zoom
    camera.updateProjectionMatrix()
    const after = groundAt(ndc)
    if (before && after) {
      const { x, z } = clampTarget(target.clone().add(before).sub(after), worldSize)
      target.set(x, 0, z)
    }
    place()
  }

  function frame(to: { x: number; z: number }, zoom: number) {
    const { x, z } = clampTarget(to, worldSize)
    target.set(x, 0, z)
    camera.zoom = clampZoom(zoom)
    camera.updateProjectionMatrix()
    place()
  }

  place()
  resize(aspect)
  return { camera, target, resize, rotate, pan, panBy, zoomAt, frame }
}
