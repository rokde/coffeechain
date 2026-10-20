import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { balance } from '../sim/balance'
import { generateWorld } from '../sim/world/generate'
import { placeProps } from '../sim/world/props'
import { buildPathGeometry, PATH } from './path'
import { parcelCenter, terrainHeightAt } from './surface'

describe('buildPathGeometry (S40b)', () => {
  it('AC-3: runs from the hut to the market and lies on the terrain for 20 seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const world = generateWorld(seed, balance())
      const { hut, market, path } = placeProps(world, balance())
      const geometry = buildPathGeometry(world, path)
      const pos = geometry.getAttribute('position')
      const v = (i: number) => new Vector3().fromBufferAttribute(pos, i)
      // The first and the last vertex pair lie on both sides of the hut and the market center.
      const start = v(0).add(v(1)).multiplyScalar(0.5)
      const end = v(pos.count - 2)
        .add(v(pos.count - 1))
        .multiplyScalar(0.5)
      const h = parcelCenter(world, hut.x, hut.y)
      const m = parcelCenter(world, market.x, market.y)
      expect([start.x, start.z]).toEqual([expect.closeTo(h.x, 6), expect.closeTo(h.z, 6)])
      expect([end.x, end.z]).toEqual([expect.closeTo(m.x, 6), expect.closeTo(m.z, 6)])

      for (let i = 0; i < pos.count; i++) {
        const p = v(i)
        expect(Math.abs(p.y - terrainHeightAt(world, p.x, p.z) - PATH.lift)).toBeLessThan(1e-6)
      }
      const index = geometry.getIndex()!
      for (let t = 0; t < index.count; t += 3) {
        for (const [a, b] of [
          [0, 1],
          [1, 2],
          [2, 0],
        ] as const) {
          const mid = v(index.getX(t + a))
            .add(v(index.getX(t + b)))
            .multiplyScalar(0.5)
          expect(mid.y).toBeGreaterThanOrEqual(terrainHeightAt(world, mid.x, mid.z))
        }
      }
    }
  })
  it('never doubles back: no two following center segments meet at an angle near 180°', () => {
    for (const seed of [...Array.from({ length: 20 }, (_, i) => i + 1), 60]) {
      const world = generateWorld(seed, balance())
      const pos = buildPathGeometry(world, placeProps(world, balance()).path).getAttribute(
        'position',
      )
      const centre = Array.from({ length: pos.count / 2 }, (_, i) =>
        new Vector3()
          .fromBufferAttribute(pos, 2 * i)
          .add(new Vector3().fromBufferAttribute(pos, 2 * i + 1))
          .multiplyScalar(0.5)
          .setY(0),
      )
      const dirs = centre.slice(1).map((c, i) => c.clone().sub(centre[i]!).normalize())
      for (let i = 1; i < dirs.length; i++) {
        expect(dirs[i]!.dot(dirs[i - 1]!)).toBeGreaterThan(-0.9)
      }
    }
  })
})
