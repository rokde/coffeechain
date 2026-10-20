import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { placeProps } from '../sim/world/props'
import {
  CAMERA,
  clampTarget,
  clampZoom,
  createCamera,
  gestureZoomDelta,
  nextZoom,
  rotateYaw,
  START_FRAME,
  START_REACH,
  START_YAW,
  startView,
  wheelZoomDelta,
} from './camera'
import { parcelAt, pickParcel } from './picking'
import { terrainHeightAt } from './surface'
import { createTerrain } from './terrain'

describe('rotateYaw', () => {
  it('returns to the start after four E steps', () => {
    let yaw = START_YAW
    for (let i = 0; i < 4; i++) yaw = rotateYaw(yaw, 1)
    expect(yaw).toBe(START_YAW)
  })

  it('undoes one E step with one Q step', () => {
    expect(rotateYaw(rotateYaw(START_YAW, 1), -1)).toBe(START_YAW)
  })

  it('changes the yaw by 90° per step', () => {
    expect(rotateYaw(START_YAW, 1)).toBe(START_YAW + 90)
    expect(rotateYaw(START_YAW, -1)).toBe(START_YAW + 270)
    expect(rotateYaw(315, 1)).toBe(45)
  })
})

const SIZE = 48
const ground = new Plane(new Vector3(0, 1, 0), 0)
const raycaster = new Raycaster()

function groundHit(camera: Camera, ndc: Vector2) {
  raycaster.setFromCamera(ndc, camera)
  return raycaster.ray.intersectPlane(ground, new Vector3())!
}

// A camera turned by 0 to 3 yaw steps.
function cameraAt(steps: number) {
  const view = createCamera(16 / 9, SIZE)
  view.rotate(steps)
  return view
}

describe('nextZoom (S22)', () => {
  it('AC-1: zooms in for a negative deltaY and out for a positive deltaY', () => {
    expect(nextZoom(1, -100)).toBeGreaterThan(1)
    expect(nextZoom(1, 100)).toBeLessThan(1)
  })

  it('AC-1: stays inside the limits, also for very large deltas', () => {
    for (const delta of [-1e9, -1e4, -1, 0, 1, 1e4, 1e9]) {
      for (const zoom of [CAMERA.minZoom, 1, CAMERA.maxZoom]) {
        const z = nextZoom(zoom, delta)
        expect(z).toBeGreaterThanOrEqual(CAMERA.minZoom)
        expect(z).toBeLessThanOrEqual(CAMERA.maxZoom)
      }
    }
    expect(nextZoom(1, -1e9)).toBe(CAMERA.maxZoom)
    expect(nextZoom(1, 1e9)).toBe(CAMERA.minZoom)
    expect(clampZoom(100)).toBe(CAMERA.maxZoom)
  })

  it('AC-1: the start zoom is 1 and lies inside the limits', () => {
    expect(createCamera(1, SIZE).camera.zoom).toBe(1)
    expect(CAMERA.minZoom).toBeLessThanOrEqual(1)
    expect(CAMERA.maxZoom).toBeGreaterThanOrEqual(1)
  })
})

describe('pinch zoom (S22 round 1)', () => {
  it('a WebKit gesture zooms by the scale ratio between two events', () => {
    expect(nextZoom(1, gestureZoomDelta(1.5, 1))).toBeCloseTo(1.5)
    expect(nextZoom(2, gestureZoomDelta(1.2, 1.5))).toBeCloseTo(1.6)
    expect(gestureZoomDelta(1.3, 1.3)).toBeCloseTo(0)
  })

  it('a ctrl wheel (Chromium pinch) zooms by the pinch factor, a plain wheel by the wheel factor', () => {
    expect(wheelZoomDelta(100, false)).toBe(100)
    expect(nextZoom(1, wheelZoomDelta(-10, true))).toBeCloseTo(Math.exp(10 * CAMERA.pinchFactor))
    expect(CAMERA.pinchFactor).toBeGreaterThan(CAMERA.wheelFactor)
  })
})

describe('zoomAt (S22)', () => {
  const cursor = new Vector2(0.6, -0.4)

  it('AC-2: keeps the ground point under the cursor for all four yaw steps', () => {
    for (let steps = 0; steps < 4; steps++) {
      const view = cameraAt(steps)
      for (const delta of [-150, -300, 200]) {
        const before = groundHit(view.camera, cursor)
        view.zoomAt(cursor, delta)
        const after = groundHit(view.camera, cursor)
        expect(after.distanceTo(before)).toBeLessThan(0.01)
      }
      expect(view.camera.zoom).not.toBe(1)
    }
  })

  it('AC-2: changes neither zoom nor target at the clamp limit', () => {
    const view = cameraAt(1)
    view.zoomAt(cursor, -1e9)
    expect(view.camera.zoom).toBe(CAMERA.maxZoom)
    const target = view.target.clone()
    view.zoomAt(cursor, -100)
    expect(view.camera.zoom).toBe(CAMERA.maxZoom)
    expect(view.target.equals(target)).toBe(true)
  })
})

describe('pan (S22)', () => {
  it('AC-3: panBy moves the target toward screen right and screen up for all four yaw steps', () => {
    for (let steps = 0; steps < 4; steps++) {
      const view = cameraAt(steps)
      const old = view.target.clone()
      view.panBy(1, 0)
      const p = old.clone().project(view.camera)
      expect(p.x).toBeLessThan(-0.01)
      expect(Math.abs(p.y)).toBeLessThan(1e-6)

      const old2 = view.target.clone()
      view.panBy(0, 1)
      const q = old2.clone().project(view.camera)
      expect(q.y).toBeLessThan(-0.01)
      expect(Math.abs(q.x)).toBeLessThan(1e-6)
    }
  })

  it('AC-3: a right drag moves the ground with the pointer', () => {
    const view = cameraAt(0)
    const ndc = new Vector2(0.2, 0.1)
    const before = groundHit(view.camera, ndc)
    // A 1600 x 900 px canvas: the pointer moves 90 px right and 45 px down.
    view.pan(90, 45, 900)
    const moved = new Vector2(0.2 + (90 / 900) * 2 * (9 / 16), 0.1 - (45 / 900) * 2)
    expect(groundHit(view.camera, moved).distanceTo(before)).toBeLessThan(0.01)
  })

  it('AC-3: clampTarget keeps x and z inside the world square', () => {
    expect(clampTarget({ x: 100, z: -100 }, SIZE)).toEqual({ x: 24, z: -24 })
    expect(clampTarget({ x: 3, z: -5 }, SIZE)).toEqual({ x: 3, z: -5 })
  })

  it('AC-3: repeated pans past the edge stop at the bound', () => {
    for (let steps = 0; steps < 4; steps++) {
      const view = cameraAt(steps)
      for (let i = 0; i < 200; i++) {
        view.panBy(5, 3)
        view.pan(-400, 300, 900)
      }
      expect(Math.abs(view.target.x)).toBeLessThanOrEqual(SIZE / 2)
      expect(Math.abs(view.target.z)).toBeLessThanOrEqual(SIZE / 2)
      expect(Math.max(Math.abs(view.target.x), Math.abs(view.target.z))).toBe(SIZE / 2)
    }
  })

  it('rotate turns around the target and keeps the zoom', () => {
    const view = cameraAt(0)
    view.zoomAt(new Vector2(0, 0), -200)
    view.panBy(4, -2)
    const target = view.target.clone()
    const zoom = view.camera.zoom
    view.rotate(1)
    expect(view.target.equals(target)).toBe(true)
    expect(view.camera.zoom).toBe(zoom)
    expect(groundHit(view.camera, new Vector2(0, 0)).distanceTo(target)).toBeLessThan(1e-6)
  })
})

describe('picking after zoom and pan (S22)', () => {
  const world = generateWorld(42, balance())
  const terrain = createTerrain(world)

  // The parcel where the line of sight through the target meets the terrain.
  function parcelUnderTarget(view: ReturnType<typeof createCamera>) {
    const dir = view.camera.getWorldDirection(new Vector3())
    raycaster.set(view.target.clone().addScaledVector(dir, -200), dir)
    return parcelAt(raycaster.intersectObject(terrain)[0]!.point, world.size)
  }

  it('AC-4: the screen centre picks the parcel under the target after zoom, pan and rotation', () => {
    const view = createCamera(16 / 9, world.size)
    view.zoomAt(new Vector2(0.3, 0.2), -300)
    view.panBy(5, -3)
    view.pan(40, -25, 900)
    view.rotate(1)
    const picked = pickParcel(new Vector2(0, 0), view.camera, terrain, world.size)
    expect(picked).not.toBeNull()
    expect(picked).toEqual(parcelUnderTarget(view))
    // The terrain is low, so the hit lies near the parcel straight below the target.
    const below = parcelAt(view.target, world.size)!
    expect(Math.abs(picked!.x - below.x) + Math.abs(picked!.y - below.y)).toBeLessThanOrEqual(4)
  })

  it('AC-4: the zoom cursor picks the same parcel before and after zoomAt', () => {
    for (let steps = 0; steps < 4; steps++) {
      const view = cameraAt(steps)
      const cursor = new Vector2(-0.25, 0.15)
      const before = pickParcel(cursor, view.camera, terrain, world.size)
      expect(before).not.toBeNull()
      view.zoomAt(cursor, -400)
      expect(pickParcel(cursor, view.camera, terrain, world.size)).toEqual(before)
    }
  })
})

describe('startView (S40b)', () => {
  const aspect = 1280 / 900
  const zoomOf = (seed: number) => {
    const world = generateWorld(seed, balance())
    const props = placeProps(world, balance())
    const view = startView(world, props, aspect)
    expect(view.zoom).toBeGreaterThanOrEqual(CAMERA.minZoom)
    expect(view.zoom).toBeLessThanOrEqual(CAMERA.maxZoom)

    const camera = createCamera(aspect, world.size)
    camera.frame(view.target, view.zoom)
    expect(camera.camera.zoom).toBe(view.zoom)
    const n = world.size
    const land = world.parcels.filter(
      (q) =>
        q.zone !== 'wasser' &&
        Math.max(Math.abs(q.x - world.start.x), Math.abs(q.y - world.start.y)) <= START_REACH,
    )
    // The start parcel is good lowland, so the land is never empty.
    expect(land.length).toBeGreaterThan(0)
    const corners = land.flatMap((q) =>
      [0, 1].flatMap((dx) => [0, 1].map((dz) => ({ x: q.x + dx - n / 2, z: q.y + dz - n / 2 }))),
    )
    const centre = (p: { x: number; y: number }) => ({
      x: p.x + 0.5 - n / 2,
      z: p.y + 0.5 - n / 2,
    })
    const points = [props.hut, props.market, ...props.path].map(centre).concat(corners)
    for (const { x, z } of points) {
      const q = new Vector3(x, terrainHeightAt(world, x, z), z).project(camera.camera)
      expect(q.x).toBeGreaterThanOrEqual(START_FRAME.left - 1e-9)
      expect(q.x).toBeLessThanOrEqual(START_FRAME.right + 1e-9)
      expect(q.y).toBeGreaterThanOrEqual(START_FRAME.bottom - 1e-9)
      expect(q.y).toBeLessThanOrEqual(START_FRAME.top + 1e-9)
    }
    return view.zoom
  }

  it('AC-1: frames the start area inside the frame region for seed 48213 and 20 more seeds', () => {
    expect(START_FRAME).toEqual({ left: -0.45, right: 0.42, bottom: -0.7, top: 0.78 })
    expect(START_REACH).toBe(4)
    expect(zoomOf(48213)).toBeGreaterThanOrEqual(2)
    for (let seed = 1; seed <= 20; seed++) zoomOf(seed)
  })

  it('AC-1: frame keeps the target inside the world and the zoom inside the limits', () => {
    const view = createCamera(aspect, SIZE)
    view.frame({ x: 100, z: -3 }, 50)
    expect([view.target.x, view.target.z]).toEqual([SIZE / 2, -3])
    expect(view.camera.zoom).toBe(CAMERA.maxZoom)
  })
})
