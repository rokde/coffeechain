import { expect, test } from '@playwright/test'

// Same ids as MODEL_FILES in src/render/models.ts. Node cannot import that file (Vite import.meta.glob).
const MODEL_IDS = [
  'hut',
  'market-stand',
  'path-straight',
  'path-corner',
  'tree-a',
  'tree-b',
  'tree-c',
  'rock-a',
  'rock-b',
]

test('S4: debug view shows each Kenney model', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('requestfailed', (request) => errors.push(`failed: ${request.url()}`))
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`)
  })

  await page.goto('/?debug=models')
  for (const id of MODEL_IDS) {
    await expect(page.getByTestId(`model-${id}`)).toBeVisible()
  }
  await page.waitForLoadState('networkidle')
  await expect(page.locator('canvas#scene')).not.toHaveAttribute('data-props')

  await page.screenshot({ path: 'docs/progress/S4-models.png' })
  expect(errors).toEqual([])
})
