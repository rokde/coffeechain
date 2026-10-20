import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useViewStore } from '../app/view'
import Hud from './Hud.vue'

vi.stubGlobal('location', { search: '?seed=42' })

async function render(open: boolean) {
  const pinia = createPinia()
  useViewStore(pinia).helpOpen = open
  return renderToString(createSSRApp(Hud).use(pinia))
}

describe('HelpOverlay (S35a)', () => {
  it('AC-3: the closed Hud has the button in the top bar and no overlay', async () => {
    const html = await render(false)
    const bar = html.split('data-testid="hud-top-bar"')[1]!.split('</header>')[0]!
    expect(bar).toContain('data-testid="help-button"')
    expect(bar).toContain('aria-label="Hilfe"')
    expect(html).not.toContain('help-overlay')
  })

  it('AC-3: the open Hud lists the six loop steps in order and all controls', async () => {
    const html = await render(true)
    expect(html).toContain('data-testid="help-overlay"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    const loop = html.split('data-testid="help-loop"')[1]!.split('</ol>')[0]!
    const names = [...loop.matchAll(/<strong[^>]*>([^<]*)<\/strong>/g)].map((m) => m[1])
    expect(names).toEqual([
      'Parzelle',
      'Pflanzen',
      'Pflegen',
      'Ernten',
      'Verkaufen',
      'Reinvestieren',
    ])
    const controls = html.split('data-testid="help-controls"')[1]!.split('</dl>')[0]!
    for (const text of [
      'Mausrad / Trackpad-Pinch',
      'Rechte Maustaste ziehen',
      'W A S D',
      'Q / E',
      '16×',
      'Leertaste',
      'Hilfe öffnen / schließen',
      'Esc',
    ])
      expect(controls).toContain(text)
    expect(html).toContain('data-testid="help-close"')
  })
})
