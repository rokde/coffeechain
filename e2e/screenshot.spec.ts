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
