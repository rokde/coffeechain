import { expect, test, type Page } from '@playwright/test'

const sizes = [
  [1440, 900],
  [800, 600],
  [390, 844],
] as const

// Writes an autosave of seed 48213 on 11 March with 1,240 CC. The next load shows the start screen with it.
async function writeAutosave(page: Page) {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { createState } = await load('/src/sim/state.ts')
    const { serialize } = await load('/src/sim/save/save.ts')
    const state = createState(48213)
    const save = { ...state, time: { ...state.time, day: 70, speed: 0 }, money: 124000 }
    localStorage.setItem('coffeechain.save.autosave', serialize(save, Date.now()))
  })
}

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

test('#3 AC-1, AC-2: the first start shows the seed preview and starts that world', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/')
  const canvas = page.locator('canvas#scene')
  await expect(page.getByTestId('start-screen')).toBeVisible()
  await expect(page.getByTestId('start-reroll')).toBeVisible()
  await expect(page.getByTestId('start-play')).toHaveText(/Spiel starten/)
  await expect(page.getByTestId('hud-top-bar')).toHaveCount(0)
  await expect(page.getByTestId('hud-toolbar')).toHaveCount(0)

  const seed = page.getByTestId('start-seed')
  await expect(canvas).toHaveAttribute('data-preview', (await seed.inputValue()).trim())
  await page.getByTestId('start-reroll').click()
  const rolled = await seed.inputValue()
  expect(rolled).toMatch(/^\d{1,10}$/)
  await expect(canvas).toHaveAttribute('data-preview', rolled)

  await seed.fill('abc')
  await expect(page.getByTestId('start-play')).toBeDisabled()
  await seed.fill('48213')
  await expect(canvas).toHaveAttribute('data-preview', '48213')
  await expect(canvas).toHaveAttribute('data-props', 'ready')
  await page.getByTestId('start-play').click()
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #48213')
  await expect(page.getByTestId('clock')).toHaveText('1. Januar, Jahr 1')
  await expect(canvas).toHaveAttribute('data-props', 'ready')
  await expect(canvas).not.toHaveAttribute('data-preview')
  expect(errors).toEqual([])
})

test('#3 AC-3: "Weiterspielen" continues the autosave', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await writeAutosave(page)
  await page.reload()
  await expect(page.getByText('Willkommen zurück')).toBeVisible()
  await expect(page.getByTestId('start-save-date')).toHaveText('11. März, Jahr 1')
  await expect(page.getByTestId('start-save-world')).toHaveText('Welt #48213')
  await expect(page.getByTestId('start-save-money')).toHaveText('1.240 CC')
  await expect(page.locator('canvas#scene')).toHaveAttribute('data-preview', '48213')
  await expect(page.getByTestId('hud-top-bar')).toHaveCount(0)
  // A double click starts one game, so one HUD.
  await page.getByTestId('start-continue').dblclick()
  await expect(page.getByTestId('clock')).toHaveText('11. März, Jahr 1')
  await expect(page.getByTestId('hud-top-bar')).toHaveCount(1)
  await expect(page.getByTestId('money')).toHaveText('1.240 CC')
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #48213')
  expect(errors).toEqual([])
})

test('#3 AC-4: "Neues Spiel" asks first and then starts the seed world', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await writeAutosave(page)
  await page.reload()
  await page.getByTestId('start-new-game').click()
  await expect(page.getByTestId('start-screen')).toContainText(
    'Das laufende Spiel geht verloren. Neues Spiel beginnen?',
  )
  await expect(page.getByTestId('start-new-game-cancel')).toBeFocused()
  await page.getByTestId('start-new-game-cancel').click()
  await expect(page.getByTestId('start-continue')).toBeVisible()
  const kept = await page.evaluate(() => localStorage.getItem('coffeechain.save.autosave'))
  await page.reload()
  await expect(page.getByTestId('start-save-date')).toHaveText('11. März, Jahr 1')
  expect(await page.evaluate(() => localStorage.getItem('coffeechain.save.autosave'))).toBe(kept)

  await page.getByTestId('start-new-game').click()
  await page.getByTestId('start-new-game-confirm').click()
  // The back button returns to the save offer.
  await page.getByTestId('start-back').click()
  await expect(page.getByTestId('start-continue')).toBeVisible()
  await page.getByTestId('start-new-game').click()
  await page.getByTestId('start-new-game-confirm').click()
  const seed = page.getByTestId('start-seed')
  await expect(seed).toBeFocused()
  await seed.fill('777')
  await expect(page.locator('canvas#scene')).toHaveAttribute('data-preview', '777')
  await seed.press('Enter')
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #777')
  await expect(page.getByTestId('clock')).toHaveText('1. Januar, Jahr 1')
  // The new game is the autosave now, so the next launch offers it.
  await page.reload()
  await expect(page.getByTestId('start-save-world')).toHaveText('Welt #777')
  expect(errors).toEqual([])
})

test('#3 AC-5: ?seed= and ?debug=models skip the start screen', async ({ page }) => {
  await page.goto('/')
  await writeAutosave(page)
  await page.goto('/?seed=48213')
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #48213')
  await expect(page.getByTestId('clock')).toHaveText('1. Januar, Jahr 1')
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  await page.goto('/?debug=models')
  await expect(page.getByTestId('model-hut')).toBeVisible()
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
})

for (const [width, height] of sizes) {
  test(`#3 AC-6: the start screen fits ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    const fits = async (name: string) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(overflow).toBe(false)
      const panel = page.locator('.panel')
      expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
      for (const button of await page.getByTestId('start-screen').locator('button').all())
        await expect(button).toBeInViewport({ ratio: 1 })
      await expect(page.locator('canvas#scene')).toHaveAttribute('data-props', 'ready')
      await page.screenshot({ path: `docs/progress/089-${name}-${width}.png` })
    }
    await page.goto('/')
    await page.getByTestId('start-seed').fill('48213')
    await expect(page.getByTestId('start-seed')).toBeInViewport({ ratio: 1 })
    await fits('first-start')
    await writeAutosave(page)
    await page.reload()
    await fits('save-game')
    await page.getByTestId('start-new-game').click()
    await fits('confirm')
  })
}

// #3 save list: a 3 minutes old autosave, a version 12 save in slot 1, invalid JSON in slot 2.
async function writeSaves(page: Page) {
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { createState } = await load('/src/sim/state.ts')
    const { serialize } = await load('/src/sim/save/save.ts')
    const at = (seed: number, day: number, money: number) => {
      const state = createState(seed)
      return { ...state, time: { ...state.time, day, speed: 0 }, money }
    }
    const set = (slot: string, text: string) =>
      localStorage.setItem(`coffeechain.save.${slot}`, text)
    set('autosave', serialize(at(48213, 70, 124000), Date.now() - 3 * 60_000))
    set('slot-1', JSON.stringify({ version: 12, state: at(777, 431, 50000) }))
    set('slot-2', '{broken')
  })
}

test('#3 save list AC-4, AC-5: the cards show the saves and a click starts slot 1 once', async ({
  page,
}) => {
  const errors = collectErrors(page)
  await page.goto('/')
  await writeSaves(page)
  await page.reload()
  const card = (slot: string) => page.getByTestId(`save-card-${slot}`)
  await expect(page.getByTestId('save-list')).toContainText('Spielstände')
  await expect(card('autosave')).toHaveText(
    /Automatisch\s*11\. März, Jahr 1\s*Welt #48213 · 1\.240 CC\s*vor 3 Minuten/,
  )
  await expect(card('slot-1')).toHaveText(/Platz 1\s*12\. März, Jahr 2\s*Welt #777 · 500 CC$/)
  await expect(card('slot-2')).toHaveText(/Platz 2\s*ungültig/)
  await expect(card('slot-3')).toHaveText(/Platz 3\s*leer/)
  await expect(page.getByTestId('start-last-played')).toHaveText('Zuletzt gespielt vor 3 Minuten')
  await expect(page.getByTestId('save-list').getByRole('button')).toHaveCount(2)
  await card('slot-1').dblclick()
  await expect(page.getByTestId('start-screen')).toHaveCount(0)
  await expect(page.getByTestId('hud-top-bar')).toHaveCount(1)
  await expect(page.getByTestId('world-seed')).toHaveText('Welt #777')
  await expect(page.getByTestId('clock')).toHaveText('12. März, Jahr 2')
  await expect(page.getByTestId('money')).toHaveText('500 CC')
  expect(errors).toEqual([])
})

test('#3 save list AC-4: no last played line for a version 12 autosave, no list without saves', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('start-seed')).toBeVisible()
  await expect(page.getByTestId('save-list')).toHaveCount(0)
  await page.evaluate(async () => {
    const load = (path: string) => import(/* @vite-ignore */ path)
    const { createState } = await load('/src/sim/state.ts')
    const state = createState(48213)
    localStorage.setItem('coffeechain.save.autosave', JSON.stringify({ version: 12, state }))
  })
  await page.reload()
  await expect(page.getByTestId('save-card-autosave')).toContainText('Welt #48213')
  await expect(page.getByTestId('start-continue')).toBeVisible()
  await expect(page.getByTestId('start-last-played')).toHaveCount(0)
})

for (const [width, height] of sizes) {
  test(`#3 save list AC-6: the save list fits ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await writeSaves(page)
    await page.reload()
    await expect(page.locator('canvas#scene')).toHaveAttribute('data-props', 'ready')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflow).toBe(false)
    const list = page.getByTestId('save-list')
    expect(await list.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    for (const slot of ['autosave', 'slot-1', 'slot-2', 'slot-3']) {
      const card = page.getByTestId(`save-card-${slot}`)
      await card.scrollIntoViewIfNeeded()
      await expect(card).toBeInViewport({ ratio: 1 })
    }
    const box = async (selector: string) => (await page.locator(selector).boundingBox())!
    // The box of the selector and the save list do not overlap.
    const apart = async (selector: string) => {
      const a = await box(selector)
      const saves = await box('[data-testid="save-list"]')
      if (width === 1440) expect(saves.x).toBeGreaterThanOrEqual(a.x + a.width)
      const free =
        saves.x >= a.x + a.width ||
        saves.x + saves.width <= a.x ||
        saves.y + saves.height <= a.y ||
        saves.y >= a.y + a.height
      expect(free, selector).toBe(true)
    }
    await apart('[data-testid="start-screen"] main')
    await page.screenshot({ path: `docs/progress/091-save-list-${width}.png` })
    // The new-game view shows the island facts in the panel (092).
    await page.getByTestId('start-new-game').click()
    await page.getByTestId('start-new-game-confirm').click()
    await expect(page.getByTestId('start-hut')).toBeVisible()
    await apart('[data-testid="start-screen"] main')
    await apart('[data-testid="start-zone-tiefland"]')
    await apart('[data-testid="start-hut"]')
    await page.screenshot({ path: `docs/progress/091-save-list-new-game-${width}.png` })
  })
}
