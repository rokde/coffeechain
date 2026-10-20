import { expect, test, type Page } from '@playwright/test'

const shots = new Set([1, 10, 20, 30])
const parcels = [
  { x: 607, y: 357 },
  { x: 758, y: 417 },
]

test('S55: a fixed-seed farm plays from day 1 to day 30', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  // The fake clock lets the test jump over the game days.
  await page.clock.install()
  await page.goto('/?seed=48213')
  const money = page.getByTestId('money')
  const storage = page.getByTestId('storage')
  const canvas = page.locator('canvas#scene')
  const clickParcels = async (points = parcels) => {
    for (const position of points) await canvas.click({ position })
  }
  const tool = (id: string) => page.getByTestId(`tool-${id}`).click()
  const moneyValue = async () =>
    Number.parseFloat(((await money.textContent()) ?? '').replace(/\./g, '').replace(',', '.'))
  const storedUnits = async () =>
    Number(/^Lager (\d+) /.exec((await storage.textContent()) ?? '')?.[1])
  const shot = async (day: number) => {
    await page.getByTestId('speed-0').click()
    await expect(page.getByTestId('clock')).toContainText(`Tag ${day} ·`)
    await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
    await page.screenshot({ path: `docs/progress/run30-day${String(day).padStart(2, '0')}.png` })
  }

  await expect(storage).toHaveText('Lager 0 / 100')
  await page.getByTestId('first-steps-close').click()

  // Buy two parcels. Build the storage on the second one, then plant the first one.
  await tool('parcel')
  await clickParcels()
  await tool('select')
  await canvas.click({ position: parcels[1] })
  await tool('build')
  await page.getByTestId('build-tool-build-storage').click()
  await expect(storage).toHaveText('Lager 0 / 250')

  const care = async () => {
    await tool('plant')
    await clickParcels()
    await tool('fertilize')
    await clickParcels()
    await tool('irrigate')
    await clickParcels()
  }
  await care()
  await shot(1)

  let sales = 0
  let day = 1
  while (day < 30) {
    await page.getByTestId('speed-4').click()
    await page.clock.fastForward(60_000)
    await page.getByTestId('speed-0').click()
    day = await readDay(page)

    await tool('harvest')
    await clickParcels()
    if ((await storedUnits()) > 0) {
      await tool('market')
      const before = await moneyValue()
      await page.getByTestId('market-robusta').getByTestId('market-sell').click()
      await expect.poll(moneyValue).toBeGreaterThan(before)
      sales++
    }
    await care()
    if (shots.has(day)) await shot(day)
  }

  expect(sales).toBeGreaterThan(0)
  expect(errors).toEqual([])
})

async function readDay(page: Page) {
  const text = (await page.getByTestId('clock').textContent()) ?? ''
  return Number(/Tag (\d+)/.exec(text)?.[1])
}
