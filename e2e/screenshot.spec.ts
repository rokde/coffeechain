import { expect, test } from '@playwright/test'

test('M0: scene and empty HUD frame', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  const hasWebGl = await page
    .locator('canvas#scene')
    .evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2') !== null)
  expect(hasWebGl).toBe(true)
  for (const slot of ['top-bar', 'left-panel', 'right-panel', 'toolbar']) {
    await expect(page.getByTestId(`hud-${slot}`)).toBeVisible()
  }
  await expect(page.getByTestId('hud-top-bar')).toContainText('CoffeeChain')

  await page.screenshot({ path: 'docs/progress/M0.png' })
  expect(errors).toEqual([])
})

test('S9: clock and speed buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('clock')).toHaveText('Tag 1 · 00:00')
  const speeds = [0, 1, 2, 4]
  const expectActive = async (active: number) => {
    for (const s of speeds) {
      await expect(page.getByTestId(`speed-${s}`)).toHaveAttribute(
        'aria-pressed',
        String(s === active),
      )
    }
  }
  await expectActive(1)
  for (const speed of speeds) {
    await page.getByTestId(`speed-${speed}`).click()
    await expectActive(speed)
  }
})

test('S9: top bar fits a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/?seed=48213')
  const bar = page.getByTestId('hud-top-bar')
  expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const s of [0, 1, 2, 4])
    await expect(page.getByTestId(`speed-${s}`)).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('world-seed')).toBeInViewport({ ratio: 1 })
})

test('S5: terrain and world seed', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #48213')
  await expect(page.getByTestId('hud-top-bar')).toContainText('Welt #48213')
  await page.screenshot({ path: 'docs/progress/S5.png' })
  expect(errors).toEqual([])
})
