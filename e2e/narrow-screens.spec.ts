import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const stepIds = ['overlay', 'parcel', 'plant', 'fertilize', 'sell']

for (const [width, height] of [
  [390, 844],
  [360, 640],
] as const) {
  test(`079: all first steps show above the toolbar at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?seed=48213')
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
      save.state.storage = {
        batches: [{ variety: 'robusta', units: 120, quality: 100, storedDay: 0 }],
      }
      localStorage.setItem(key, JSON.stringify(save))
    })
    await page.getByTestId('save-panel-close').click()
    await page.getByTestId('save-button').click()
    await page.getByTestId('save-slot-1').getByTestId('save-slot-load').click()
    await page.getByTestId('first-steps-close').click()
    await expect(page.getByTestId('money')).toHaveText('9.999.999.999 CC')

    const bar = (await page.getByTestId('hud-top-bar').boundingBox())!
    // The portrait bar has three rows: time, stats, seed and time unit.
    expect(Math.abs(bar.height - 129)).toBeLessThanOrEqual(1)
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
  await page.goto('/?seed=48213')
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

test.describe('#42: one finger on a phone', () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } })

  test('a one-finger drag pans and buys nothing, a long press and drag paints', async ({
    page,
  }) => {
    await page.goto('/?seed=48213')
    await page.getByTestId('first-steps-close').click()
    await page.getByTestId('speed-toggle').click()
    await expect(page.getByTestId('speed-toggle')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('group-field').click()
    await page.getByTestId('tool-parcel').click()
    await expect(page.getByTestId('tool-parcel')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
    const canvas = page.locator('canvas#scene')
    const money = page.getByTestId('money')
    const before = await canvas.screenshot()

    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x = 0, y = 0) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      })
    await touch('touchStart', 200, 400)
    for (let i = 1; i <= 10; i++) await touch('touchMove', 200 - i * 8, 400 - i * 5)
    await touch('touchEnd')
    await expect(money).toHaveText('500 CC')
    await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false)

    // A long press starts the brush, so the drag acts on the parcels under the finger.
    await touch('touchStart', 195, 420)
    await page.waitForTimeout(600)
    for (let i = 1; i <= 6; i++) await touch('touchMove', 195 + i * 6, 420 + i * 4)
    await touch('touchEnd')
    await expect
      .poll(
        async () =>
          (await money.textContent()) !== '500 CC' ||
          (await page.getByTestId('tool-note').count()) > 0,
      )
      .toBe(true)
  })
})
