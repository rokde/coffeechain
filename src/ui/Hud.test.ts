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

describe('Hud phase chip (S47)', () => {
  it('AC-5: shows phase 1 and the progress for a new game', async () => {
    // 500 CC start capital of 2.000 CC.
    expect(await chip()).toBe('Phase 1 · 25 %')
  })

  it('AC-5: shows phase 3 with no progress at 10.000 CC', async () => {
    expect(await chip(1_000_000)).toBe('Phase 3')
  })
})
