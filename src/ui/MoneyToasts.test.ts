import { createPinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useBookingsStore, type Toast } from '../app/bookings'
import MoneyToasts from './MoneyToasts.vue'

async function render(toasts: Toast[]) {
  const pinia = createPinia()
  useBookingsStore(pinia).toasts = toasts
  return renderToString(createSSRApp(MoneyToasts).use(pinia))
}
const toastTags = (html: string) =>
  [...html.matchAll(/<div ([^>]*data-testid="money-toast"[^>]*)>([^<]*)</g)].map((m) => ({
    attrs: m[1]!,
    text: m[2]!.trim(),
  }))

describe('MoneyToasts (S58)', () => {
  it('AC-3: a cost shows a minus sign and the reason, not in green', async () => {
    const [toast] = toastTags(await render([{ id: 0, reason: 'parcel', amount: -4000, last: 0 }]))
    expect(toast!.text).toMatch(/^−\S+ CC Parzelle$/)
    expect(toast!.attrs).not.toContain('income')
  })

  it('AC-3: an income shows a plus sign and the reason, in green', async () => {
    const [toast] = toastTags(await render([{ id: 0, reason: 'sell', amount: 1250, last: 0 }]))
    expect(toast!.text).toMatch(/^\+\S+ CC Verkauf$/)
    expect(toast!.attrs).toContain('income')
  })

  it('the list is a polite live region', async () => {
    const html = await render([])
    expect(html).toMatch(/role="status"[^>]*aria-live="polite"/)
  })
})
