import { expect, test } from '@playwright/test'

const speeds = [0, 1, 2, 4, 8, 16]
const tools = ['select', 'parcel', 'plant', 'fertilize', 'irrigate', 'protect', 'harvest', 'market']

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
  // The longest seed is the worst case for the width.
  await page.goto('/?seed=4294967295')
  const bar = page.getByTestId('hud-top-bar')
  expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const s of speeds) await expect(page.getByTestId(`speed-${s}`)).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('world-seed')).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('money')).toBeInViewport({ ratio: 1 })
  await expect(page.getByTestId('storage')).toBeInViewport({ ratio: 1 })
})

test('S21c: keys change the speed', async ({ page }) => {
  await page.goto('/')
  const expectActive = async (active: number) => {
    for (const s of speeds) {
      await expect(page.getByTestId(`speed-${s}`)).toHaveAttribute(
        'aria-pressed',
        String(s === active),
      )
    }
  }
  await expectActive(1)
  // Space on a focused button must not also click it.
  await page.getByTestId('speed-2').focus()
  await page.keyboard.press('5')
  await expectActive(16)
  await page.keyboard.press('Space')
  await expectActive(0)
  await page.keyboard.press('Space')
  await expectActive(16)
  await page.keyboard.press('0')
  await expectActive(0)
  await page.keyboard.press('3')
  await expectActive(4)

  await page.evaluate(() => {
    const input = document.createElement('input')
    input.dataset.testid = 'probe-input'
    document.body.append(input)
  })
  await page.getByTestId('probe-input').focus()
  await page.keyboard.press('5')
  await page.keyboard.press('Space')
  await expectActive(4)
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

test('S8: parcel inspector', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const inspector = page.getByTestId('parcel-inspector')
  await expect(inspector).toHaveCount(0)

  // The screen centre shows the island centre, which is land.
  await page.locator('canvas#scene').click({ position: { x: 720, y: 450 } })
  await expect(inspector).toBeVisible()
  await expect(page.getByTestId('hud-right-panel')).toContainText('Parzelle')
  await expect(page.getByTestId('inspector-zone')).toHaveText(
    /^(Tiefland|Hochland|Kühles Hochland|Vulkan)$/,
  )
  await expect(page.getByTestId('inspector-soil')).toHaveText(/^(Karg|Mittel|Gut|Sehr gut)$/)
  await expect(page.getByTestId('inspector-variety')).toHaveText(
    /^(Robusta|Arabica Standard|Arabica Premium|Specialty)$/,
  )
  await expect(page.getByTestId('inspector-buildable')).toHaveText(/^(nicht )?bebaubar$/)
  await page.screenshot({ path: 'docs/progress/S8.png' })

  await page.getByRole('button', { name: 'Auswahl schließen' }).click()
  await expect(inspector).toHaveCount(0)

  // A click on the open sea misses the terrain and clears the selection.
  await page.locator('canvas#scene').click({ position: { x: 720, y: 450 } })
  await expect(inspector).toBeVisible()
  await page.locator('canvas#scene').click({ position: { x: 200, y: 880 } })
  await expect(inspector).toHaveCount(0)
  expect(errors).toEqual([])
})

test('S6: props on the island', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  // Seed 7 has a corner in the path, see CORNER_SEED in src/render/props.test.ts.
  await page.goto('/?seed=7')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S6.png' })
  expect(errors).toEqual([])
})

test('S7: soil and zone overlay switches', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const soil = page.getByTestId('overlay-soil')
  const zone = page.getByTestId('overlay-zone')
  await expect(soil).toHaveAttribute('aria-checked', 'false')
  await expect(zone).toHaveAttribute('aria-checked', 'false')

  await zone.click()
  await expect(zone).toHaveAttribute('aria-checked', 'true')
  await expect(soil).toHaveAttribute('aria-checked', 'false')

  await soil.click()
  await expect(soil).toHaveAttribute('aria-checked', 'true')
  await expect(zone).toHaveAttribute('aria-checked', 'false')
  const legend = page.getByTestId('overlay-legend')
  for (const name of ['Karg', 'Mittel', 'Gut', 'Sehr gut']) {
    await expect(legend.getByText(name, { exact: true })).toBeVisible()
  }
  await page.screenshot({ path: 'docs/progress/S7.png', animations: 'disabled' })

  await soil.click()
  await expect(soil).toHaveAttribute('aria-checked', 'false')
  await expect(legend).toHaveCount(0)
  expect(errors).toEqual([])
})

test('S7: overlay panel fits a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const panel = page.getByTestId('hud-overlay-panel')
  for (const mode of ['soil', 'zone']) {
    await page.getByTestId(`overlay-${mode}`).click()
    const track = page.getByTestId(`overlay-${mode}`).locator('.track')
    const box = (await panel.boundingBox())!
    const t = (await track.boundingBox())!
    expect(t.width).toBe(46)
    // The track must end at the inner edge of the panel, in line with the other switch.
    const padding = await panel.evaluate((el) => parseFloat(getComputedStyle(el).paddingRight))
    expect(t.x + t.width).toBeCloseTo(box.x + box.width - padding, 0)
    for (const item of await page.getByTestId('overlay-legend').locator('li').all()) {
      const fits = await item.evaluate((el) => el.scrollWidth <= el.clientWidth)
      const b = (await item.boundingBox())!
      expect(fits && b.x + b.width <= box.x + box.width).toBe(true)
    }
  }
})

for (const [width, height] of [
  [1280, 800],
  [390, 844],
] as const) {
  test(`S7: overlay panel and inspector do not overlap at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?seed=48213')
    await page.getByTestId('overlay-soil').click()
    // The screen centre shows the island centre, which is land.
    await page.locator('canvas#scene').click({ position: { x: width / 2, y: height / 2 } })
    await expect(page.getByTestId('parcel-inspector')).toBeVisible()
    const a = (await page.getByTestId('hud-overlay-panel').boundingBox())!
    for (const id of ['hud-right-panel', 'parcel-inspector']) {
      const b = (await page.getByTestId(id).boundingBox())!
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      expect(apart).toBe(true)
    }
  })
}

test('S12: parcel tool and money', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const money = page.getByTestId('money')
  await expect(money).toHaveText('500 CC')
  await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('tool-parcel').click()
  await expect(page.getByTestId('tool-parcel')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('tool-select')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByTestId('parcel-tool')).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)

  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  const canvas = page.locator('canvas#scene')
  await canvas.click({ position: { x: 640, y: 370 } })
  await canvas.click({ position: { x: 690, y: 400 } })
  await expect(page.getByTestId('parcel-tool-count')).toHaveText('2')
  await expect(page.getByTestId('parcel-tool-total')).toHaveText('148 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S12.png' })

  await page.getByTestId('parcel-tool-create').click()
  await expect(money).toHaveText('352 CC')
  await expect(page.getByTestId('parcel-tool-count')).toHaveText('0')
  await expect(page.getByTestId('parcel-tool-create')).toBeDisabled()

  // An owned parcel cannot be selected again.
  await canvas.click({ position: { x: 640, y: 370 } })
  await expect(page.getByTestId('parcel-tool-count')).toHaveText('0')

  await page.getByTestId('tool-select').click()
  await expect(page.getByTestId('parcel-tool')).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const [width, height] of [
  [1280, 800],
  [390, 844],
] as const) {
  test(`S12: parcel tool and money do not overlap other panels at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?seed=48213')
    await page.getByTestId('overlay-soil').click()
    await page.getByTestId('tool-parcel').click()
    await expect(page.getByTestId('parcel-tool')).toBeVisible()
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!
    const pairs = [
      ['hud-overlay-panel', 'parcel-tool'],
      ['hud-overlay-panel', 'hud-right-panel'],
      ['hud-overlay-panel', 'money'],
      ['hud-right-panel', 'money'],
      ['hud-left-panel', 'money'],
      ['hud-overlay-panel', 'storage'],
      ['hud-right-panel', 'storage'],
      ['hud-left-panel', 'storage'],
    ]
    for (const [first, second] of pairs) {
      const a = await box(first!)
      const b = await box(second!)
      const apart =
        a.x + a.width <= b.x ||
        b.x + b.width <= a.x ||
        a.y + a.height <= b.y ||
        b.y + b.height <= a.y
      expect(apart, `${first} and ${second}`).toBe(true)
    }
  })
}

test('S13: plant tool', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const money = page.getByTestId('money')
  const canvas = page.locator('canvas#scene')
  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  const clicks = [
    { x: 640, y: 370 },
    { x: 690, y: 400 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('parcel-tool-create').click()
  await expect(money).toHaveText('352 CC')

  await page.getByTestId('tool-plant').click()
  await expect(page.getByTestId('plant-tool')).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  await expect(page.getByTestId('plant-tool-plant')).toBeDisabled()
  for (const position of clicks) await canvas.click({ position })
  await expect(page.getByTestId('plant-tool-count')).toHaveText('2')
  await expect(page.getByTestId('plant-tool-total')).toHaveText('4 CC')
  await page.getByTestId('plant-tool-variety-arabicaStandard').click()
  await expect(page.getByTestId('plant-tool-variety-arabicaStandard')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByTestId('plant-tool-total')).toHaveText('8 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S13.png' })

  await page.getByTestId('plant-tool-plant').click()
  await expect(money).toHaveText('344 CC')
  await expect(page.getByTestId('plant-tool-count')).toHaveText('0')

  // A parcel with a plant cannot be selected again.
  await canvas.click({ position: clicks[0] })
  await expect(page.getByTestId('plant-tool-count')).toHaveText('0')
  expect(errors).toEqual([])
})

test('S12b: owned parcel marks and field labels', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const labels = page.locator('[data-testid^="field-label-"]')
  await expect(page.getByTestId('hud-top-bar')).toBeVisible()
  await expect(labels).toHaveCount(0)

  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  await page.getByTestId('tool-parcel').click()
  const canvas = page.locator('canvas#scene')
  await canvas.click({ position: { x: 640, y: 370 } })
  await canvas.click({ position: { x: 690, y: 400 } })
  await page.getByTestId('parcel-tool-create').click()

  await expect(page.getByTestId('field-label-A')).toHaveText('Feld A')
  await expect(page.getByTestId('field-label-B')).toHaveText('Feld B')
  await expect(labels).toHaveCount(2)
  const bounds = (await canvas.boundingBox())!
  for (const name of ['A', 'B']) {
    const label = page.getByTestId(`field-label-${name}`)
    // The animation loop places a label after its first frame.
    await expect(label).not.toHaveAttribute('style', /^((?!left).)*$/)
    const b = (await label.boundingBox())!
    expect(b.x >= bounds.x && b.y >= bounds.y).toBe(true)
    expect(b.x + b.width <= bounds.x + bounds.width).toBe(true)
    expect(b.y + b.height <= bounds.y + bounds.height).toBe(true)
  }
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.getByTestId('tool-select').click()
  await page.screenshot({ path: 'docs/progress/S12b.png' })
  expect(errors).toEqual([])
})

test('S20: market panel from the toolbar and the market stand', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const panel = page.getByTestId('market-panel')
  await page.getByTestId('tool-market').click()
  await expect(page.getByTestId('tool-market')).toHaveText('Markt')
  await expect(panel).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S20.png' })
  // The panel fits the right panel without a scroll bar.
  expect(await panel.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true)

  // Select a land parcel first: the market click must clear it.
  const canvas = page.locator('canvas#scene')
  await page.getByTestId('tool-select').click()
  await canvas.click({ position: { x: 720, y: 450 } })
  await expect(page.getByTestId('parcel-inspector')).toBeVisible()
  // The market stand parcel (34, 39) of seed 48213 at the start camera.
  await canvas.click({ position: { x: 640, y: 686 } })
  await expect(page.getByTestId('tool-market')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel).toBeVisible()
  await page.getByTestId('tool-select').click()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('S20: market panel fits a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  for (const tool of tools)
    await expect(page.getByTestId(`tool-${tool}`)).toBeInViewport({ ratio: 1 })
  await page.getByTestId('tool-market').click()
  const panel = page.getByTestId('market-panel')
  await expect(panel).toBeVisible()
  expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const row of await panel.locator('dl').all())
    expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
})

test('S13b: plant meshes', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const canvas = page.locator('canvas#scene')
  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  const clicks = [
    { x: 640, y: 370 },
    { x: 690, y: 400 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('parcel-tool-create').click()
  await page.getByTestId('tool-plant').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('plant-tool-plant').click()
  await expect(page.getByTestId('money')).toHaveText('348 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S13b.png' })
  expect(errors).toEqual([])
})

test('S18a: care and harvest tools, storage chip', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  // A fake clock lets the test jump over the growth time.
  await page.clock.install()
  await page.goto('/?seed=48213')
  const money = page.getByTestId('money')
  const storage = page.getByTestId('storage')
  const canvas = page.locator('canvas#scene')
  await expect(storage).toHaveText('Lager 0 / 100')
  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  const clicks = [
    { x: 640, y: 370 },
    { x: 690, y: 400 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('parcel-tool-create').click()
  await page.getByTestId('tool-plant').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('plant-tool-plant').click()
  await expect(money).toHaveText('348 CC')

  const labels = await page.getByTestId('hud-toolbar').getByRole('button').allTextContents()
  expect(labels.map((l) => l.trim())).toEqual([
    'Auswählen',
    'Parzelle',
    'Pflanzen',
    'Düngen',
    'Wässern',
    'Schutz',
    'Ernten',
    'Markt',
  ])

  await page.getByTestId('tool-fertilize').click()
  await expect(page.getByTestId('farm-tool')).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  await expect(page.getByTestId('farm-tool-apply')).toBeDisabled()
  for (const position of clicks) await canvas.click({ position })
  await expect(page.getByTestId('farm-tool-count')).toHaveText('2')
  await expect(page.getByTestId('farm-tool-total')).toHaveText('2 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S18a.png' })
  await page.getByTestId('farm-tool-apply').click()
  await expect(money).toHaveText('346 CC')
  await expect(page.getByTestId('farm-tool-count')).toHaveText('0')

  // Robusta needs 72 ticks. One frame runs at most 24 ticks, so jump 4 times at speed 4.
  await page.getByTestId('speed-4').click()
  for (let i = 0; i < 4; i++) await page.clock.fastForward(60_000)
  await page.getByTestId('speed-0').click()
  await page.getByTestId('tool-harvest').click()
  for (const position of clicks) await canvas.click({ position })
  await expect(page.getByTestId('farm-tool-count')).toHaveText('2')
  await page.getByTestId('farm-tool-apply').click()
  await expect(page.getByTestId('farm-tool-count')).toHaveText('0')
  await expect(storage).not.toHaveText('Lager 0 / 100')
  await expect(storage).toHaveText(/^Lager \d+ \/ 100$/)
  expect(errors).toEqual([])
})

for (const width of [1280, 390]) {
  test(`S18a: all tools fit the toolbar at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/')
    const toolbar = page.getByTestId('hud-toolbar')
    expect(await toolbar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    for (const tool of tools) {
      const button = page.getByTestId(`tool-${tool}`)
      await expect(button).toBeInViewport({ ratio: 1 })
      // The label is not cut off.
      expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    }
  })
}

test('S18c: inspector yield forecast', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const canvas = page.locator('canvas#scene')
  // Buildable lowland parcel (18, 23) of seed 48213 at the start camera.
  const position = { x: 640, y: 370 }
  await page.getByTestId('tool-parcel').click()
  await canvas.click({ position })
  await page.getByTestId('parcel-tool-create').click()
  await page.getByTestId('tool-select').click()
  await canvas.click({ position })
  await expect(page.getByTestId('parcel-inspector')).toBeVisible()
  await expect(page.getByTestId('inspector-yield')).toHaveCount(0)

  await page.getByTestId('tool-plant').click()
  await canvas.click({ position })
  await page.getByTestId('plant-tool-plant').click()
  await page.getByTestId('tool-select').click()
  await canvas.click({ position })
  await expect(page.getByTestId('inspector-yield')).toHaveText(/^\d+ Einheiten$/)
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S18c.png' })
  expect(errors).toEqual([])
})

test('S23: field labels fade on hover', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  // Buildable lowland parcels (18, 23) and (21, 23) of seed 48213 at the start camera.
  await page.getByTestId('tool-parcel').click()
  const canvas = page.locator('canvas#scene')
  await canvas.click({ position: { x: 640, y: 370 } })
  await canvas.click({ position: { x: 690, y: 400 } })
  await page.getByTestId('parcel-tool-create').click()
  await page.getByTestId('tool-select').click()

  const labelA = page.getByTestId('field-label-A')
  const labelB = page.getByTestId('field-label-B')
  const opacity = (label: typeof labelA) => label.evaluate((el) => getComputedStyle(el).opacity)
  await expect(labelA).not.toHaveAttribute('style', /^((?!left).)*$/)
  expect(await labelA.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')

  // Field A: the parcel at (640, 370).
  await canvas.hover({ position: { x: 640, y: 370 } })
  await expect.poll(() => opacity(labelA)).toBe('0')
  expect(await opacity(labelB)).toBe('1')

  // A new field under the still mouse rebuilds the labels. Label A stays faded.
  await page.getByTestId('tool-parcel').click()
  await canvas.click({ position: { x: 720, y: 450 } })
  await canvas.hover({ position: { x: 640, y: 370 } })
  await expect.poll(() => opacity(labelA)).toBe('0')
  await page.getByTestId('parcel-tool-create').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('field-label-C')).toBeAttached()
  expect(await opacity(labelA)).toBe('0')
  await page.getByTestId('tool-select').click()

  // The island centre is land with no field.
  await canvas.hover({ position: { x: 720, y: 450 } })
  await expect.poll(() => opacity(labelA)).toBe('1')
  await expect.poll(() => opacity(labelB)).toBe('1')

  // A click at the label goes through the label layer to the parcel under it.
  const box = (await labelA.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByTestId('parcel-inspector')).toBeVisible()
  await expect.poll(() => opacity(labelA)).toBe('0')
  expect(errors).toEqual([])
})

test('S22: wheel zoom, right-drag pan and picking after zoom', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const canvas = page.locator('canvas#scene')
  const inspector = page.getByTestId('parcel-inspector')
  const title = inspector.locator('.title')
  // Pause the game, so that only the camera changes the image.
  await page.getByTestId('speed-0').click()

  await canvas.click({ position: { x: 720, y: 450 } })
  await expect(inspector).toBeVisible()
  const selected = await title.textContent()

  const before = await canvas.screenshot()
  await page.mouse.move(800, 400)
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(false)

  // A right-drag pans the view. It keeps the selection and opens no context menu.
  const menus = page.evaluate(
    () =>
      new Promise<boolean>((resolve) =>
        window.addEventListener('contextmenu', (event) => resolve(event.defaultPrevented), {
          once: true,
        }),
      ),
  )
  await page.mouse.move(700, 500)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(600, 450, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  expect(await menus).toBe(true)
  await expect(title).toHaveText(selected!)

  await page.getByRole('button', { name: 'Auswahl schließen' }).click()
  await expect(inspector).toHaveCount(0)
  await canvas.click({ position: { x: 720, y: 450 } })
  await expect(inspector).toBeVisible()
  expect(errors).toEqual([])
})
