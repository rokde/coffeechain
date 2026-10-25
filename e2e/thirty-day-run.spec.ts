import { expect, test, type Page } from '@playwright/test'
import de from '../src/ui/i18n/de.json' with { type: 'json' }

const shotMonths = [10, 20, 30]
const parcels = [
  { x: 607, y: 357 },
  { x: 758, y: 417 },
]

test('S55: a fixed-seed farm plays from month 1 to month 30', async ({ page }) => {
  test.setTimeout(600_000)
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))

  // The fake clock lets the test jump over the game months.
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
  const shot = async (month: number, name = month) => {
    await page.getByTestId('speed-0').click()
    await tool('select')
    await expect.poll(() => readMonth(page)).toBe(month)
    await expect(page.locator('canvas#scene[data-props="ready"]')).toBeAttached()
    await page.screenshot({ path: `docs/progress/run30-day${String(name).padStart(2, '0')}.png` })
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
  let month = 1
  while (month < 30) {
    await page.getByTestId('speed-4').click()
    await page.clock.fastForward(60_000)
    await page.getByTestId('speed-0').click()
    month = await readMonth(page)

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
    // A jump never skips a shot month silently: the shot waits for the first month at or after it.
    if (month >= (shotMonths[0] ?? Infinity)) await shot(month, shotMonths.shift()!)
  }

  expect(shotMonths, 'all shot months were taken').toEqual([])
  expect(sales, 'no harvest reached storage in 30 months').toBeGreaterThan(0)
  expect(errors).toEqual([])
})

// The month count from the start: "1. Februar, Jahr 2" is month 14.
async function readMonth(page: Page) {
  const text = (await page.getByTestId('clock').textContent()) ?? ''
  const [, name, year] = /^\d+\. (\S+), Jahr (\d+)$/.exec(text) ?? []
  return (Number(year) - 1) * 12 + de.time.months.indexOf(name ?? '') + 1
}
