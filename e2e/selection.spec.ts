import { expect, test, type Page } from '@playwright/test'

const SEED = 48213

type Point = { x: number; y: number }

// Screen points of free parcels, found from the parcel grid and the start camera, not from fixed pixels.
// The page builds the same camera, start framing and terrain as the app, so a new start camera does not break the test.
// block: the corners of a free 2 × 2 block and one more free parcel beside it.
// wide: the corners of a grid square whose free parcels cost more than the start money.
async function findParcels(page: Page) {
  return page.evaluate(async (seed) => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { createCamera, startView } = await load('/src/render/camera.ts')
    const { createTerrain } = await load('/src/render/terrain.ts')
    const { pickParcel } = await load('/src/render/picking.ts')
    const { createState } = await load('/src/sim/state.ts')
    const { canSelect } = await load('/src/app/selection.ts')
    const { quoteParcels } = await load('/src/sim/farm/parcels.ts')
    const state = createState(seed)
    const size: number = state.world.size
    const view = createCamera(innerWidth / innerHeight, size)
    const terrain = createTerrain(state.world)
    // The app frames the start view after it builds the scene.
    const start = startView(state.world, state.props, innerWidth / innerHeight)
    view.frame(start.target, start.zoom)
    // The centre of the screen points that hit each parcel, between the HUD panels.
    const hits = new Map<number, { x: number; y: number; n: number }>()
    for (let sy = 120; sy < 780; sy += 8)
      for (let sx = 360; sx < 1080; sx += 8) {
        const ndc = { x: (sx / innerWidth) * 2 - 1, y: 1 - (sy / innerHeight) * 2 }
        const p = pickParcel(ndc, view.camera, terrain, size)
        if (!p) continue
        const h = hits.get(p.y * size + p.x) ?? { x: 0, y: 0, n: 0 }
        hits.set(p.y * size + p.x, { x: h.x + sx, y: h.y + sy, n: h.n + 1 })
      }
    const point = (x: number, y: number) => {
      const h = hits.get(y * size + x)
      return h && h.n >= 3 ? { x: h.x / h.n, y: h.y / h.n } : null
    }
    const free = (x: number, y: number) =>
      x < size && y < size && canSelect(state, 'parcel', { x, y })
    let block: Point[] | null = null
    let wide: Point[] | null = null
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const cells = [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
          [x + 2, y],
        ]
        const points = cells.map(([cx, cy]) => (free(cx!, cy!) ? point(cx!, cy!) : null))
        if (!block && points.every((q) => q)) block = points as Point[]
        const k = 9
        const from = point(x, y)
        const to = point(x + k - 1, y + k - 1)
        if (wide || !from || !to) continue
        const square = []
        for (let qy = y; qy < y + k; qy++)
          for (let qx = x; qx < x + k; qx++) if (free(qx, qy)) square.push({ x: qx, y: qy })
        if (quoteParcels(state, square) > state.money) wide = [from, to]
      }
    return { block, wide }
  }, SEED)
}

test('S40c: selection first marks a rectangle, then the tool buys it', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto(`/?seed=${SEED}`)
  await page.getByTestId('first-steps-close').click()
  const money = page.getByTestId('money')
  const count = page.getByTestId('parcel-tool-count')
  const armed = (tool: string) =>
    expect(page.getByTestId(`tool-${tool}`)).toHaveAttribute('aria-pressed', 'true')
  const drag = async (from: Point, to: Point) => {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 10 })
    await page.mouse.up()
  }
  const { block, wide } = await findParcels(page)
  expect(block).not.toBeNull()
  expect(wide).not.toBeNull()
  const [a, b, c, d, e] = block!

  // AC-4: marks that cost more than the money disable the confirm button.
  await drag(wide![0]!, wide![1]!)
  await page.getByTestId('tool-parcel').click()
  await expect(page.getByTestId('parcel-tool-create')).toBeDisabled()
  await expect(page.getByTestId('parcel-tool-short')).toHaveText('Nicht genug CC.')
  await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
  await page.screenshot({ path: 'docs/progress/S40c-short.png' })
  // Esc puts down the tool and clears the marks.
  await page.keyboard.press('Escape')
  await armed('select')
  await page.getByTestId('tool-parcel').click()
  await expect(count).toHaveCount(0)

  // A click marks one parcel, Shift-click adds or removes one.
  await page.getByTestId('tool-select').click()
  await page.mouse.click(a!.x, a!.y)
  await expect(page.getByTestId('parcel-inspector')).toBeVisible()
  await page.keyboard.down('Shift')
  await page.mouse.click(b!.x, b!.y)
  await page.mouse.click(c!.x, c!.y)
  await page.mouse.click(b!.x, b!.y)
  await page.keyboard.up('Shift')
  await page.getByTestId('tool-parcel').click()
  await expect(count).toHaveText('2')
  // A right-click puts down the tool and clears the marks.
  await page.mouse.click(e!.x, e!.y, { button: 'right' })
  await armed('select')
  await page.getByTestId('tool-parcel').click()
  await expect(count).toHaveCount(0)
  await page.getByTestId('tool-select').click()

  // AC-5: a left drag over the 2 × 2 block marks 4 parcels, and confirm buys them.
  await drag(a!, d!)
  await page.getByTestId('tool-parcel').click()
  await expect(count).toHaveText('4')
  await expect(page.getByTestId('parcel-tool-create')).toBeEnabled()
  await page.screenshot({ path: 'docs/progress/S40c.png' })
  await page.getByTestId('parcel-tool-create').click()
  await expect(money).not.toHaveText('500 CC')
  await expect(count).toHaveCount(0)
  await armed('parcel')
  const bought = await money.textContent()
  for (const p of [a, b, c, d]) {
    await page.mouse.click(p!.x, p!.y)
    await expect(page.getByTestId('tool-note')).toHaveText('Hier nicht möglich.')
  }
  await expect(money).toHaveText(bought!)
  // Tool first still works: a click on a free parcel buys it at once.
  await page.mouse.click(e!.x, e!.y)
  await expect(money).not.toHaveText(bought!)

  // The help lists both ways.
  await page.keyboard.press('Escape')
  await page.keyboard.press('h')
  const help = page.getByTestId('help-controls')
  for (const text of [
    'Linksklick mit Auswählen',
    'Umschalt + Linksklick mit Auswählen',
    'Linke Maustaste ziehen mit Auswählen',
    'Erst markieren, dann Werkzeug',
  ])
    await expect(help).toContainText(text)
  expect(errors).toEqual([])
})
