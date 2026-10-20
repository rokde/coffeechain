import { expect, test } from '@playwright/test'

const speeds = [0, 1, 2, 4, 8, 16]
const tools = [
  'select',
  'parcel',
  'plant',
  'fertilize',
  'irrigate',
  'protect',
  'harvest',
  'build',
  'market',
]

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

for (const width of [800, 390]) {
  test(`S47: phase chip fits the top bar at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/?seed=4294967295')
    const bar = page.getByTestId('hud-top-bar')
    await expect(page.getByTestId('phase')).toHaveText('Phase 1 · 25 %')
    await page.screenshot({ path: `docs/progress/S47-${width}.png` })
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expect(page.getByTestId('phase')).toBeInViewport({ ratio: 1 })
    const seed = (await page.getByTestId('world-seed').boundingBox())!
    const storage = (await page.getByTestId('storage').boundingBox())!
    // At 390 px the seed and the stats are tabs below the bar. They must not overlap.
    expect(seed.x + seed.width <= storage.x || seed.y + seed.height <= storage.y).toBe(true)
  })
}

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

  // The screen centre shows parcel (35, 38) at the start view, which is land.
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

  // Seed 7 has a corner in the path.
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
    // The screen centre shows parcel (35, 38) at the start view, which is land.
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

  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  const canvas = page.locator('canvas#scene')
  // S40: each click buys its parcel at once. No confirm button is necessary.
  await canvas.click({ position: { x: 607, y: 357 } })
  await canvas.click({ position: { x: 758, y: 417 } })
  await expect(money).toHaveText('457,2 CC')
  await expect(page.getByTestId('parcel-tool-create')).toHaveCount(0)
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S12.png' })

  // An owned parcel cannot be bought again.
  await canvas.click({ position: { x: 607, y: 357 } })
  await expect(page.getByTestId('tool-note')).toHaveText('Hier nicht möglich.')
  await expect(money).toHaveText('457,2 CC')

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
  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  const clicks = [
    { x: 607, y: 357 },
    { x: 758, y: 417 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await expect(money).toHaveText('457,2 CC')

  await page.getByTestId('tool-plant').click()
  await expect(page.getByTestId('plant-tool')).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  await expect(page.getByTestId('plant-tool-plant')).toHaveCount(0)
  await page.getByTestId('plant-tool-variety-arabicaStandard').click()
  await expect(page.getByTestId('plant-tool-variety-arabicaStandard')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // S40 AC-3: one click plants Arabica Standard at once, and the tool stays armed.
  // One Arabica seed costs 4 CC, one Robusta seed 2 CC.
  await canvas.click({ position: clicks[0] })
  await expect(money).toHaveText('453,2 CC')
  await expect(page.getByTestId('tool-plant')).toHaveAttribute('aria-pressed', 'true')
  await canvas.click({ position: clicks[1] })
  await expect(money).toHaveText('449,19 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S13.png' })

  // A parcel with a plant cannot be planted again.
  await canvas.click({ position: clicks[0] })
  await expect(page.getByTestId('tool-note')).toHaveText('Hier nicht möglich.')
  await expect(money).toHaveText('449,19 CC')
  expect(errors).toEqual([])
})

test('S44: build tool', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  const money = page.getByTestId('money')
  const canvas = page.locator('canvas#scene')
  // Buildable lowland parcel (32, 38) of seed 48213 at the start view.
  const position = { x: 607, y: 357 }
  await page.getByTestId('tool-parcel').click()
  await canvas.click({ position })
  await expect(money).toHaveText('485 CC')

  await page.getByTestId('tool-select').click()
  await canvas.click({ position })
  await page.getByTestId('tool-build').click()
  await expect(page.getByTestId('build-tool')).toBeVisible()
  await expect(page.getByTestId('build-tool-processing')).toContainText('150 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S44.png' })

  await page.getByTestId('build-tool-build-processing').click()
  await expect(money).toHaveText('335 CC')
  await expect(page.getByTestId('build-tool-build-processing')).toBeDisabled()
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

  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  await page.getByTestId('tool-parcel').click()
  const canvas = page.locator('canvas#scene')
  await canvas.click({ position: { x: 607, y: 357 } })
  await canvas.click({ position: { x: 758, y: 417 } })

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
  // The market stand parcel (34, 39) of seed 48213 at the start view.
  await canvas.click({ position: { x: 644, y: 447 } })
  await expect(page.getByTestId('tool-market')).toHaveAttribute('aria-pressed', 'true')
  await expect(panel).toBeVisible()
  await page.getByTestId('tool-select').click()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('S40b: start view frames the hut, the market stand and the path', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/?seed=48213')
  const canvas = page.locator('canvas#scene')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.getByTestId('speed-0').click()
  await page.screenshot({ path: 'docs/progress/S40b.png' })

  // The projected screen point of the market stand parcel (34, 39) at 1280 x 900.
  await canvas.click({ position: { x: 573, y: 447 } })
  await expect(page.getByTestId('market-panel')).toBeVisible()
  await page.getByTestId('tool-select').click()

  await page.getByTestId('overlay-soil').click()
  await page.screenshot({ path: 'docs/progress/S40b-soil.png', animations: 'disabled' })
  await page.getByTestId('overlay-soil').click()

  // One large wheel step clamps the zoom to CAMERA.minZoom. The cursor stays on the hut.
  await page.mouse.move(606, 465)
  await page.mouse.wheel(0, 10_000)
  await page.screenshot({ path: 'docs/progress/S40b-far.png' })

  // Seed 48213 has a path of one step. Seed 60 has the longest climb of seeds 1 to 60.
  await page.goto('/?seed=60')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.getByTestId('speed-0').click()
  await page.screenshot({ path: 'docs/progress/S40b-slope.png' })
  await page.getByTestId('overlay-soil').click()
  await page.screenshot({ path: 'docs/progress/S40b-slope-soil.png', animations: 'disabled' })
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
  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  const clicks = [
    { x: 607, y: 357 },
    { x: 758, y: 417 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('tool-plant').click()
  for (const position of clicks) await canvas.click({ position })
  await expect(page.getByTestId('money')).toHaveText('453,2 CC')
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
  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  const clicks = [
    { x: 607, y: 357 },
    { x: 758, y: 417 },
  ]
  await page.getByTestId('tool-parcel').click()
  for (const position of clicks) await canvas.click({ position })
  await page.getByTestId('tool-plant').click()
  for (const position of clicks) await canvas.click({ position })
  await expect(money).toHaveText('453,2 CC')

  const labels = await page.getByTestId('hud-toolbar').getByRole('button').allTextContents()
  expect(labels.map((l) => l.trim())).toEqual([
    'Auswählen',
    'Parzelle',
    'Pflanzen',
    'Düngen',
    'Wässern',
    'Schutz',
    'Ernten',
    'Bauen',
    'Markt',
  ])

  await page.getByTestId('tool-fertilize').click()
  await expect(page.getByTestId('farm-tool')).toBeVisible()
  await expect(page.getByTestId('parcel-inspector')).toHaveCount(0)
  await expect(page.getByTestId('farm-tool-apply')).toHaveCount(0)
  for (const position of clicks) await canvas.click({ position })
  await expect(money).toHaveText('451,2 CC')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S18a.png' })

  // Robusta needs 72 ticks. One frame runs at most 24 ticks, so jump 4 times at speed 4.
  await page.getByTestId('speed-4').click()
  for (let i = 0; i < 4; i++) await page.clock.fastForward(60_000)
  await page.getByTestId('speed-0').click()
  await page.getByTestId('tool-harvest').click()
  for (const position of clicks) await canvas.click({ position })
  await expect(storage).not.toHaveText('Lager 0 / 100')
  await expect(storage).toHaveText(/^Lager \d+ \/ 100$/)
  expect(errors).toEqual([])
})

for (const width of [1280, 390, 360]) {
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
  // Buildable lowland parcel (32, 38) of seed 48213 at the start view.
  const position = { x: 607, y: 357 }
  await page.getByTestId('tool-parcel').click()
  await canvas.click({ position })
  await page.getByTestId('tool-select').click()
  await canvas.click({ position })
  await expect(page.getByTestId('parcel-inspector')).toBeVisible()
  await expect(page.getByTestId('inspector-yield')).toHaveCount(0)

  await page.getByTestId('tool-plant').click()
  await canvas.click({ position })
  await page.getByTestId('tool-select').click()
  await canvas.click({ position })
  await expect(page.getByTestId('inspector-yield')).toHaveText(/^\d+ Einheiten$/)
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S18c.png' })
  expect(errors).toEqual([])
})

test('S21e: field status and care buttons in the inspector', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  await page.getByTestId('first-steps-close').click()
  const canvas = page.locator('canvas#scene')
  // Buildable lowland parcel (32, 38) of seed 48213 at the start view.
  const position = { x: 607, y: 357 }
  await page.getByTestId('tool-parcel').click()
  await canvas.click({ position })
  await page.getByTestId('tool-plant').click()
  await canvas.click({ position })
  await page.getByTestId('tool-select').click()
  await canvas.click({ position })

  await expect(page.getByTestId('inspector-stage')).toHaveText('Setzling')
  await expect(page.getByTestId('inspector-growth')).toHaveText(/^\d+ %$/)
  await expect(page.getByTestId('inspector-days')).toHaveText(/^Reif in (\d+ Tagen|1 Tag)$/)
  await expect(page.getByTestId('inspector-care')).toHaveText('keine')
  await expect(page.getByTestId('inspector-care-action')).toHaveText([
    'Düngen',
    'Wässern',
    'Schützen',
  ])
  await expect(page.getByTestId('message')).toContainText(['Feld A braucht Pflege'])

  await page.getByTestId('inspector-care-action').filter({ hasText: 'Wässern' }).click()
  await expect(page.getByTestId('inspector-care')).toHaveText('gewässert')
  await expect(page.getByTestId('inspector-care-hint')).toHaveText([
    'Düngen möglich',
    'Schützen möglich',
  ])
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S21e.png' })

  // At phone width the panel scrolls, and no value or button leaves the panel.
  await page.setViewportSize({ width: 390, height: 844 })
  const panel = page.getByTestId('hud-right-panel')
  await expect(panel).toHaveCSS('overflow-y', 'auto')
  const box = (await panel.boundingBox())!
  const last = page.getByTestId('inspector-care-action').last()
  await last.scrollIntoViewIfNeeded()
  const button = (await last.boundingBox())!
  expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width)
  expect(button.y + button.height).toBeLessThanOrEqual(box.y + box.height)
  const clipped = await page
    .locator('[data-testid="parcel-inspector"] dd')
    .evaluateAll((dds) =>
      dds.filter((d) => d.scrollWidth > d.clientWidth).map((d) => d.textContent),
    )
  expect(clipped).toEqual([])
  await page.screenshot({ path: 'docs/progress/S21e-narrow.png' })
  expect(errors).toEqual([])
})

test('S23: field labels fade on hover', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  // Buildable lowland parcels (32, 38) and (35, 37) of seed 48213 at the start view.
  await page.getByTestId('tool-parcel').click()
  const canvas = page.locator('canvas#scene')
  await canvas.click({ position: { x: 607, y: 357 } })
  await canvas.click({ position: { x: 758, y: 417 } })
  await page.getByTestId('tool-select').click()

  const labelA = page.getByTestId('field-label-A')
  const labelB = page.getByTestId('field-label-B')
  const opacity = (label: typeof labelA) => label.evaluate((el) => getComputedStyle(el).opacity)
  await expect(labelA).not.toHaveAttribute('style', /^((?!left).)*$/)
  expect(await labelA.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')

  // Field A: the parcel at (607, 357).
  await canvas.hover({ position: { x: 607, y: 357 } })
  await expect.poll(() => opacity(labelA)).toBe('0')
  expect(await opacity(labelB)).toBe('1')

  // A new field under the still mouse rebuilds the labels. Label A stays faded.
  // A synthetic press buys parcel (36, 40) at (682, 515) while the mouse stays still on field A.
  await page.getByTestId('tool-parcel').click()
  await canvas.hover({ position: { x: 607, y: 357 } })
  await expect.poll(() => opacity(labelA)).toBe('0')
  // pointerId 1 is the mouse in Chromium. The stroke captures it, so the test releases it.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas#scene')!
    const at = { clientX: 682, clientY: 515, button: 0, buttons: 1, pointerId: 1 }
    canvas.dispatchEvent(new PointerEvent('pointerdown', at))
    canvas.dispatchEvent(new PointerEvent('pointerup', at))
    canvas.releasePointerCapture(1)
  })
  await expect(page.getByTestId('field-label-C')).toBeAttached()
  expect(await opacity(labelA)).toBe('0')
  await page.getByTestId('tool-select').click()

  // The screen centre shows parcel (35, 38), which is land with no field.
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

test('S25: first steps tick, highlight and close', async ({ page }) => {
  await page.goto('/?seed=48213')
  await expect(page.getByTestId('first-steps')).toBeVisible()
  await expect(page.locator('[data-guide="next"]')).toHaveCount(1)
  await expect(page.getByTestId('overlay-soil')).toHaveAttribute('data-guide', 'next')
  await page.getByTestId('overlay-soil').click()
  await expect(page.getByTestId('first-step-overlay')).toHaveAttribute('data-done', 'true')
  await expect(page.getByTestId('tool-parcel')).toHaveAttribute('data-guide', 'next')
  await page.getByTestId('first-steps-close').click()
  await expect(page.getByTestId('message-panel')).toBeVisible()
  await expect(page.locator('[data-guide="next"]')).toHaveCount(0)
})

test('S35a: help overlay opens and closes', async ({ page }) => {
  await page.goto('/')
  const overlay = page.getByTestId('help-overlay')
  await expect(overlay).toHaveCount(0)
  await page.getByTestId('help-button').click()
  await expect(overlay).toBeVisible()
  await page.screenshot({ path: 'docs/progress/help-overlay.png' })
  await page.keyboard.press('Escape')
  await expect(overlay).toHaveCount(0)
  await page.keyboard.press('h')
  await expect(overlay).toBeVisible()
  await page.getByTestId('help-close').click()
  await expect(overlay).toHaveCount(0)
})

test('S35a: help keys leave the speed alone and ignore inputs', async ({ page }) => {
  await page.goto('/')
  const pressed = (s: number) => page.getByTestId(`speed-${s}`)
  await page.keyboard.press('3')
  await expect(pressed(4)).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('h')
  await expect(page.getByTestId('help-overlay')).toBeVisible()
  await expect(pressed(4)).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('H')
  await expect(page.getByTestId('help-overlay')).toHaveCount(0)
  await expect(pressed(4)).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Space')
  await expect(pressed(0)).toHaveAttribute('aria-pressed', 'true')

  await page.evaluate(() => {
    const input = document.createElement('input')
    input.dataset.testid = 'probe-input'
    document.body.append(input)
  })
  await page.getByTestId('probe-input').focus()
  await page.keyboard.press('h')
  await expect(page.getByTestId('help-overlay')).toHaveCount(0)
})

test('S35a: help button and overlay fit a narrow window', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/')
  const bar = (await page.getByTestId('hud-top-bar').boundingBox())!
  const button = (await page.getByTestId('help-button').boundingBox())!
  expect(button.x + button.width).toBeLessThanOrEqual(bar.x + bar.width)
  await page.getByTestId('help-button').click()
  const panel = (await page.getByTestId('help-overlay').boundingBox())!
  expect(panel.x).toBeGreaterThanOrEqual(0)
  expect(panel.x + panel.width).toBeLessThanOrEqual(360)
})

test('S25: help keys work while the checklist is open', async ({ page }) => {
  await page.goto('/?seed=48213')
  await expect(page.getByTestId('first-steps')).toBeVisible()
  await page.keyboard.press('h')
  await expect(page.getByTestId('help-overlay')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-overlay')).toHaveCount(0)
  await expect(page.getByTestId('first-steps')).toBeVisible()
})

test('S42b: save panel saves and loads a slot', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?seed=48213')
  const panel = page.getByTestId('save-panel')
  await expect(panel).toHaveCount(0)
  await page.getByTestId('save-button').click()
  await expect(panel).toBeVisible()
  const row = page.getByTestId('save-slot-2')
  for (const slot of [1, 2, 3]) {
    const r = page.getByTestId(`save-slot-${slot}`)
    await expect(r.getByTestId('save-slot-status')).toHaveText('leer')
    await expect(r.getByTestId('save-slot-load')).toBeDisabled()
  }

  const money = page.getByTestId('money')
  await expect(money).toHaveText('500 CC')
  await row.getByTestId('save-slot-save').click()
  await expect(row.getByTestId('save-slot-status')).toHaveText(/^Tag \d+$/)
  await expect(row.getByTestId('save-slot-load')).toBeEnabled()
  await page.screenshot({ path: 'docs/progress/save-panel.png' })
  await page.getByTestId('save-panel-close').click()
  await expect(panel).toHaveCount(0)

  // Buildable lowland parcel (18, 23) of seed 48213 at the start camera.
  await page.getByTestId('tool-parcel').click()
  await page.locator('canvas#scene').click({ position: { x: 640, y: 370 } })
  await expect(money).not.toHaveText('500 CC')

  await page.getByTestId('save-button').click()
  await row.getByTestId('save-slot-load').click()
  await expect(money).toHaveText('500 CC')
  await expect(panel).toHaveCount(0)
  expect(errors).toEqual([])
})

for (const width of [360, 390]) {
  test(`S42b: save button fits the top bar at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/?seed=4294967295')
    const bar = page.getByTestId('hud-top-bar')
    expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    const box = (await bar.boundingBox())!
    for (const id of ['save-button', 'help-button']) {
      const button = (await page.getByTestId(id).boundingBox())!
      expect(button.x).toBeGreaterThanOrEqual(box.x)
      expect(button.x + button.width).toBeLessThanOrEqual(box.x + box.width)
    }
    await page.getByTestId('save-button').click()
    const panel = (await page.getByTestId('save-panel').boundingBox())!
    expect(panel.x).toBeGreaterThanOrEqual(0)
    expect(panel.x + panel.width).toBeLessThanOrEqual(width)
    await page.screenshot({ path: `docs/progress/save-panel-${width}.png` })
  })
}

test('S42b: top bar fits a narrow window at day 9999', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/?seed=4294967295')
  await page.getByTestId('save-button').click()
  await page.getByTestId('save-slot-1').getByTestId('save-slot-save').click()
  await expect(page.getByTestId('save-slot-1').getByTestId('save-slot-load')).toBeEnabled()
  await page.evaluate(() => {
    const key = 'coffeechain.save.slot-1'
    const save = JSON.parse(localStorage.getItem(key)!)
    save.state.time = { ...save.state.time, hour: 9998 * 24 + 23, speed: 0 }
    localStorage.setItem(key, JSON.stringify(save))
  })
  await page.getByTestId('save-panel-close').click()
  await page.getByTestId('save-button').click()
  await page.getByTestId('save-slot-1').getByTestId('save-slot-load').click()
  await expect(page.getByTestId('clock')).toHaveText('Tag 9999 · 23:00')
  const bar = page.getByTestId('hud-top-bar')
  expect(await bar.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
  for (const id of ['clock', 'speed-0', 'speed-16', 'save-button', 'help-button'])
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 })
  await page.screenshot({ path: 'docs/progress/save-panel-day-9999.png' })
})

test('S43: the game writes the autosave at a new day, and the panel can load it', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/?seed=48213')
  await page.getByTestId('save-button').click()
  const row = page.getByTestId('save-autosave')
  await expect(row).toContainText('Automatisch')
  await expect(row.getByTestId('save-slot-status')).toHaveText('leer')
  await expect(row.getByTestId('save-slot-load')).toBeDisabled()
  await expect(row.getByTestId('save-slot-save')).toHaveCount(0)
  await page.getByTestId('save-panel-close').click()

  // At speed 16 one game day takes 15 real seconds.
  await page.getByTestId('speed-16').click()
  await expect(page.getByTestId('clock')).toHaveText(/^Tag 2 /, { timeout: 30_000 })
  await page.getByTestId('speed-0').click()
  await page.getByTestId('save-button').click()
  await expect(row.getByTestId('save-slot-status')).toHaveText('Tag 2')
  await page.screenshot({ path: 'docs/progress/save-panel-autosave.png' })
  await row.getByTestId('save-slot-load').click()
  await expect(page.getByTestId('clock')).toHaveText(/^Tag 2 · 00:00$/)
  expect(errors).toEqual([])
})

test('S43b: the game resumes from the autosave, and "Neues Spiel" starts day 1', async ({
  page,
}) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const clock = page.getByTestId('clock')
  await page.goto('/')
  // At speed 16 one game day takes 15 real seconds.
  await page.getByTestId('speed-16').click()
  await expect(clock).toHaveText(/^Tag 2 /, { timeout: 30_000 })
  await page.getByTestId('speed-0').click()
  await page.reload()
  await expect(clock).toHaveText(/^Tag 2 /)

  await page.getByTestId('save-button').click()
  await page.getByTestId('save-new-game').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('save-new-game-cancel')).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('save-new-game-confirm')).toHaveCount(0)
  await expect(page.getByTestId('save-new-game')).toBeFocused()
  await page.getByTestId('save-new-game').click()
  await expect(page.getByTestId('save-new-game-confirm')).toHaveText('Ja, neues Spiel')
  await expect(page.getByTestId('save-panel')).toContainText(
    'Das laufende Spiel geht verloren. Neues Spiel beginnen?',
  )
  await expect(clock).toHaveText(/^Tag 2 /)
  await page.screenshot({ path: 'docs/progress/save-panel-new-game.png' })
  await page.getByTestId('save-new-game-confirm').click()
  await expect(clock).toHaveText(/^Tag 1 /)
  await expect(page.getByTestId('save-panel')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('S43b: a broken autosave gives a new game', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('coffeechain.save.autosave', '{broken'))
  await page.goto('/')
  await expect(page.getByTestId('clock')).toHaveText(/^Tag 1 /)
  const canvas = page.locator('canvas#scene')
  await expect(canvas).toHaveAttribute('data-props', 'ready')
  expect(await canvas.evaluate((c: HTMLCanvasElement) => c.getContext('webgl2') !== null)).toBe(
    true,
  )
  expect(errors).toEqual([])
})

test('S40: tool brush paints, notes and disarms', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/?seed=48213')
  await page.getByTestId('first-steps-close').click()
  const canvas = page.locator('canvas#scene')
  const money = page.getByTestId('money')
  const armed = (tool: string) =>
    expect(page.getByTestId(`tool-${tool}`)).toHaveAttribute('aria-pressed', 'true')
  await expect(canvas).toHaveCSS('cursor', 'auto')

  // A left drag over lowland buys each parcel under the pointer once and does not pan the camera.
  await page.getByTestId('tool-parcel').click()
  expect(await canvas.evaluate((el) => el.style.cursor)).toMatch(/^url\("data:image\/svg\+xml,/)
  await page.mouse.move(607, 357)
  await page.mouse.down()
  await page.mouse.move(758, 417, { steps: 10 })
  await page.mouse.up()
  const after = await money.textContent()
  expect(after).not.toBe('500 CC')
  // The parcel at the start of the drag is owned now, so the camera did not move.
  await canvas.click({ position: { x: 607, y: 357 } })
  await expect(page.getByTestId('tool-note')).toHaveText('Hier nicht möglich.')
  await expect(money).toHaveText(after!)

  // A right-drag pans and keeps the tool. A right-click without a drag puts it down.
  await page.mouse.move(700, 500)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(600, 450, { steps: 5 })
  await page.mouse.up({ button: 'right' })
  await armed('parcel')
  await canvas.click({ button: 'right', position: { x: 600, y: 450 } })
  await armed('select')
  await expect(canvas).toHaveCSS('cursor', 'auto')

  // Esc with the help open only closes the help. A second Esc puts down the tool.
  await page.getByTestId('tool-plant').click()
  await page.keyboard.press('h')
  await expect(page.getByTestId('help-overlay')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('help-overlay')).toHaveCount(0)
  await armed('plant')
  await page.keyboard.press('Escape')
  await armed('select')

  await page.getByTestId('tool-harvest').click()
  await page.getByTestId('tool-select').click()
  await armed('select')
  expect(errors).toEqual([])
})

test('S40: a release over the HUD ends the stroke', async ({ page }) => {
  await page.goto('/?seed=48213')
  await page.getByTestId('first-steps-close').click()
  const money = page.getByTestId('money')
  await page.getByTestId('tool-parcel').click()
  // The first stroke ends with a release over the right panel.
  const panel = (await page.getByTestId('hud-right-panel').boundingBox())!
  const inPanel = { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 }
  await page.mouse.move(200, 880)
  await page.mouse.down()
  await page.mouse.move(inPanel.x, inPanel.y, { steps: 5 })
  await page.mouse.up()
  await page.waitForTimeout(100)
  const after = (await money.textContent())!
  // A press on the panel and a drag onto lowland must not paint with the old stroke.
  await page.mouse.down()
  await page.mouse.move(607, 357, { steps: 10 })
  await page.mouse.move(758, 417, { steps: 5 })
  await page.mouse.up()
  await expect(money).toHaveText(after)
})

for (const [width, height] of [
  [1280, 800],
  [390, 844],
] as const) {
  test(`S40: armed plant tool with a note at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/?seed=48213')
    await page.getByTestId('tool-plant').click()
    await page.getByTestId('plant-tool-variety-arabicaStandard').click()
    // The screen centre shows parcel (35, 38), which is land that the farm does not own.
    await page.locator('canvas#scene').click({ position: { x: width / 2, y: height / 2 } })
    const note = page.getByTestId('tool-note')
    await expect(note).toHaveText('Hier nicht möglich.')
    const panel = page.getByTestId('hud-right-panel')
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
    await page.screenshot({ path: `docs/progress/S40-${width}.png` })
  })
}
