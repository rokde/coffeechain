import { BoxGeometry, Group, InstancedMesh, Mesh, Scene, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'
import type { ModelId } from '../render/models'
import { createProps } from '../render/props'
import { createPlants, plantsKey, plantVariants, STAGES } from '../render/plants'
import { createTerrain } from '../render/terrain'
import { balance } from '../sim/balance'
import type { GameState } from '../sim/state'
import { step } from '../sim/time/time'
import { PERF_PLANTS, perfFixture } from './perfFixture'

// Test limits, not balancing numbers. A 60 fps frame has 16.7 ms.
const TICK_BUDGET_MS = 4
const DAY_TICK_BUDGET_MS = 16
const RENDER_UPDATE_BUDGET_MS = 8
// Median over some runs after warm-up runs, so that the JIT and CPU noise from parallel tests do not fail the test.
const WARMUP = 3
const RUNS = 9

const state = perfFixture()
const ticksPerDay = balance().time.ticksPerGameDay

const median = (times: number[]) => [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)]!

function time(run: () => void): number {
  const start = performance.now()
  run()
  return performance.now() - start
}

// One game day from the fixture. The last tick is the day boundary.
function day() {
  let s: GameState = state
  const ticks = Array.from({ length: ticksPerDay }, () => time(() => (s = step(s))))
  expect(s.time.hour % ticksPerDay).toBe(0)
  return { ticks: ticks.slice(0, -1), boundary: ticks.at(-1)! }
}

describe('performance on a full farm (S54)', () => {
  it('the fixture has 2,000 plants on the 48 × 48 world in all variants', () => {
    expect(state.world.size).toBe(balance().world.size)
    expect(Object.keys(state.farm.plants)).toHaveLength(PERF_PLANTS)
    expect(plantVariants(state.farm.plants, state.time.hour).size).toBe(20)
  })

  it('AC-1: one tick and the day-boundary tick of step() stay in budget', () => {
    expect(state.time.hour % ticksPerDay).toBe(0)
    for (let i = 0; i < WARMUP; i++) day()
    const runs = Array.from({ length: RUNS }, day)
    const tick = median(runs.flatMap((r) => r.ticks))
    const boundary = median(runs.map((r) => r.boundary))
    console.log(`step: tick ${tick.toFixed(3)} ms, day boundary ${boundary.toFixed(3)} ms`)
    expect(tick).toBeLessThan(TICK_BUDGET_MS)
    expect(boundary).toBeLessThan(DAY_TICK_BUDGET_MS)
  })

  it('AC-2: plantsKey() and plants.show() together stay in budget', () => {
    const plants = createPlants(state.world)
    const { hour } = state.time
    // main.ts calls plantsKey() each tick and show() when the key changes.
    const update = () => {
      plantsKey(state.farm.plants, hour)
      plants.show(state.farm.plants, hour)
    }
    for (let i = 0; i < WARMUP; i++) update()
    const ms = median(Array.from({ length: RUNS }, () => time(update)))
    console.log(`render update: ${ms.toFixed(3)} ms`)
    expect(ms).toBeLessThan(RENDER_UPDATE_BUDGET_MS)
  })

  it('AC-3: terrain and plants need at most one draw call per variant plus one', () => {
    const plants = createPlants(state.world)
    plants.show(state.farm.plants, state.time.hour)
    const scene = new Scene().add(createTerrain(state.world), plants.group)
    const drawn: Mesh[] = []
    scene.traverseVisible((o) => {
      if (o instanceof Mesh && !(o instanceof InstancedMesh && o.count === 0)) drawn.push(o)
    })
    const variants = Object.keys(balance().varieties).length * STAGES.length
    expect(variants).toBe(20)
    expect(drawn.length).toBeLessThanOrEqual(1 + variants)
    const instanced = drawn.filter((m) => m instanceof InstancedMesh)
    expect(instanced).toHaveLength(drawn.length - 1)
    expect(instanced.reduce((sum, m) => sum + m.count, 0)).toBe(PERF_PLANTS)
  })

  it('S54b AC-5: trees need at most one draw call per tree model and mesh part', async () => {
    const PARTS = 2
    const load = async (id: ModelId): Promise<Object3D> =>
      id.startsWith('tree')
        ? new Group().add(new Mesh(new BoxGeometry(0.1, 0.6, 0.1)), new Mesh(new BoxGeometry()))
        : new Mesh(new BoxGeometry())
    const props = await createProps(state.world, state.props, load)
    const trees = props.children.filter(
      (c): c is InstancedMesh => c instanceof InstancedMesh && c.count > 0,
    )
    expect(state.props.trees.length).toBeGreaterThan(3)
    expect(trees.length).toBeGreaterThan(0)
    expect(trees.length).toBeLessThanOrEqual(3 * PARTS)
    expect(trees.reduce((sum, m) => sum + m.count, 0)).toBe(PARTS * state.props.trees.length)
  })
})
