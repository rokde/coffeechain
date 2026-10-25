import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const stepIds = ['overlay', 'parcel', 'plant', 'fertilize', 'sell']

for (const [width, height] of [
  [390, 844],
  [360, 640],
] as const) {
  test(`079: all first steps show above the toolbar at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    const toolbarTop = (await page.getByTestId('hud-toolbar').boundingBox())!.y
    const panel = (await page.getByTestId('hud-left-panel').boundingBox())!
    expect(panel.y + panel.height).toBeLessThanOrEqual(toolbarTop)
    const scrollBox = page.getByTestId('first-steps')
    const scrolls = await scrollBox.evaluate((el) => el.scrollHeight > el.clientHeight)
    // The list scrolls only when the panel is at its limit.
    if (width === 390) expect(scrolls).toBe(false)
    for (const id of stepIds) {
      const item = page.getByTestId(`first-step-${id}`)
      await item.scrollIntoViewIfNeeded()
      const box = (await item.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(panel.y)
      expect(box.y + box.height).toBeLessThanOrEqual(panel.y + panel.height)
      expect(box.y + box.height).toBeLessThanOrEqual(toolbarTop)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
  })

  test(`079: huge money keeps the stats on one line at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?seed=4294967295')
    await page.getByTestId('save-button').click()
    await page.getByTestId('save-slot-1').getByTestId('save-slot-save').click()
    await page.evaluate(() => {
      const key = 'coffeechain.save.slot-1'
      const save = JSON.parse(localStorage.getItem(key)!)
      save.state.time = { ...save.state.time, day: 3509, speed: 0 }
      save.state.money = 999_999_999_900
      save.state.buildings = { 0: { kind: 'storage' }, 1: { kind: 'storage' } }
      save.state.storage = { batches: [{ variety: 'robusta', units: 120, quality: 100 }] }
      localStorage.setItem(key, JSON.stringify(save))
    })
    await page.getByTestId('save-panel-close').click()
    await page.getByTestId('save-button').click()
    await page.getByTestId('save-slot-1').getByTestId('save-slot-load').click()
    await page.getByTestId('first-steps-close').click()
    await expect(page.getByTestId('money')).toHaveText('9.999.999.999 CC')

    const bar = (await page.getByTestId('hud-top-bar').boundingBox())!
    expect(Math.abs(bar.height - 94)).toBeLessThanOrEqual(1)
    // The chips differ in height, so one row means the same vertical centre.
    const centres = await Promise.all(
      ['money', 'storage', 'phase'].map(async (id) => {
        const box = (await page.getByTestId(id).boundingBox())!
        return box.y + box.height / 2
      }),
    )
    expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(2)
    for (const id of ['money', 'storage', 'phase', 'clock']) {
      const box = (await page.getByTestId(id).boundingBox())!
      expect(box.x + box.width).toBeLessThanOrEqual(width)
    }
    const money = page.getByTestId('money')
    const label = (await money.getAttribute('title')) ?? (await money.getAttribute('aria-label'))
    expect(label).toContain('9.999.999.999')
  })
}

// Expected boxes were read on main at 34b2b15.
test('079: the 1440x900 layout keeps its boxes', async ({ page }) => {
  await page.goto('/')
  const expected = {
    'hud-top-bar': { x: 16, y: 16, width: 1408, height: 60 },
    'hud-left-panel': { x: 16, y: 92, width: 300, height: 214.9375 },
    'hud-right-panel': { x: 1094, y: 92, width: 330, height: 56 },
  }
  for (const [id, box] of Object.entries(expected)) {
    const actual = (await page.getByTestId(id).boundingBox())!
    expect(actual.x).toBeCloseTo(box.x, 1)
    expect(actual.y).toBeCloseTo(box.y, 1)
    expect(actual.width).toBeCloseTo(box.width, 1)
    expect(Math.abs(actual.height - box.height)).toBeLessThanOrEqual(1)
  }
})

test('079: Hud.vue comments no longer name the removed overlay panel', () => {
  const text = readFileSync('src/ui/Hud.vue', 'utf8')
  expect(text).not.toContain('top 328px')
  expect(text).not.toContain('the overlay panel moves down')
  expect(text).not.toContain('above the overlay panel')
})
