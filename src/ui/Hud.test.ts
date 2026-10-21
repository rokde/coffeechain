import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useGameStore } from '../app/store'
import type { GameState } from '../sim/state'
import Hud from './Hud.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

// Text of the phase chip for a game with the given balance in hundredths of CC.
async function chip(money?: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  if (money !== undefined) game.replace({ ...(game.state as GameState), money })
  const html = await renderToString(createSSRApp(Hud).use(pinia))
  // The chip text, with the text of the progress span and no tags.
  const inner = html.match(
    /data-testid="phase"[^>]*>((?:[^<]|<span[^>]*>[^<]*<\/span>|<!--[^>]*-->)*)<\/span>/,
  )![1]!
  return inner
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// The title and the aria-label of the phase chip.
async function hint(money?: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const game = useGameStore(pinia)
  if (money !== undefined) game.replace({ ...(game.state as GameState), money })
  const html = await renderToString(createSSRApp(Hud).use(pinia))
  const tag = html.match(/<span[^>]*data-testid="phase"[^>]*>/)![0]
  return { title: tag.match(/title="([^"]*)"/)![1], label: tag.match(/aria-label="([^"]*)"/)![1] }
}

describe('Hud phase chip (S47)', () => {
  it('AC-5: shows phase 1 and the progress for a new game', async () => {
    // 500 CC start capital of 2.000 CC.
    expect(await chip()).toBe('Phase 1 · 25 %')
  })

  it('AC-5: shows phase 3 with no progress at 10.000 CC', async () => {
    expect(await chip(1_000_000)).toBe('Phase 3')
  })

  it('round 1: the title and the aria-label give the capital and the next threshold', async () => {
    expect(await hint()).toEqual({
      title: 'Kapital 500 CC · nächste Phase ab 2.000 CC',
      label: 'Phase 1 · 25 % · Kapital 500 CC · nächste Phase ab 2.000 CC',
    })
  })

  it('round 1: the title and the aria-label say that phase 3 is the highest phase', async () => {
    expect(await hint(1_000_000)).toEqual({
      title: 'Höchste Phase erreicht',
      label: 'Phase 3 · Höchste Phase erreicht',
    })
  })
})

describe('Hud money group (S58c)', () => {
  it('AC-1: holds money and storage, each with one hidden icon', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const html = await renderToString(createSSRApp(Hud).use(pinia))
    const group = html.match(/<div[^>]*data-testid="money-group"[^>]*>(.*?)<\/div>/)![1]!
    // Money is the first item and storage the second one.
    const [money, storage] = group.split(/(?=<span[^>]*data-testid="storage")/)
    const item = (html: string) => {
      const inner = html.replace(/^<span[^>]*>/, '')
      const svgs = inner.match(/<svg[^>]*>/g) ?? []
      return {
        icons: svgs.length,
        hidden: svgs.every((tag) => tag.includes('aria-hidden="true"')),
        text: inner
          .replace(/<svg.*<\/svg>/, '')
          .replace(/<[^>]*>/g, '')
          .trim(),
      }
    }
    expect(item(storage!)).toEqual({ icons: 1, hidden: true, text: 'Lager 0 / 100' })
    // At 480 px or less the word "Lager" is hidden, so the tooltip and the label keep it.
    expect(storage).toMatch(/^<span[^>]*title="Lager 0 \/ 100" aria-label="Lager 0 \/ 100"/)
    // 069-whole-cc can drop the decimals, so both forms pass.
    expect(item(money!)).toMatchObject({ icons: 1, hidden: true })
    expect(item(money!).text).toMatch(/^500(,00)? CC$/)
  })
})
