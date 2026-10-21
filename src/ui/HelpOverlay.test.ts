import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useViewStore } from '../app/view'
import Hud from './Hud.vue'
import { overlays, tools } from './toolbar'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

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
      'Linksklick mit Werkzeug',
      'Linke Maustaste ziehen mit Werkzeug',
      'Hilfe schließen / Werkzeug ablegen',
      'Rechtsklick',
      'Werkzeug ablegen',
      'Linksklick mit Auswählen',
      'Umschalt + Linksklick mit Auswählen',
      'Rechteck markieren',
      'Erst markieren, dann Werkzeug',
      'Kosten prüfen und rechts bestätigen',
    ])
      expect(controls).toContain(text)
    expect(controls.match(/<dt[^>]*>Esc/g)).toHaveLength(1)
    expect(html).toContain('data-testid="help-close"')
  })
})

describe('tool keys and tooltips (S53)', () => {
  it('AC-3: each toolbar button has the title "<label> (<KEY>)" and aria-keyshortcuts', async () => {
    const html = await render(false)
    expect(tools).toHaveLength(9)
    for (const tool of tools) {
      const button = html.match(new RegExp(`<button[^>]*data-testid="tool-${tool.id}"[^>]*>`))![0]
      expect(button).toContain(`title="${tool.label} (${tool.key})"`)
      expect(button).toContain(`aria-keyshortcuts="${tool.key}"`)
    }
    expect(html).toMatch(/<button[^>]*data-testid="tool-plant"[^>]*title="Pflanzen \(L\)"/)
  })

  it('AC-5: the help lists one row per tool with its key and label, after the old rows', async () => {
    const html = await render(true)
    const controls = html.split('data-testid="help-controls"')[1]!.split('</dl>')[0]!
    const rows = [...controls.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)]
    const old = rows.length - tools.length - overlays.length
    expect(old).toBe(16)
    expect(rows.slice(old, old + tools.length).map((m) => [m[1], m[2]])).toEqual(
      tools.map((tool) => [tool.key, `Werkzeug ${tool.label}`]),
    )
  })

  it('S60 AC-3: the help lists O and Z with the overlay names after the tools', async () => {
    const html = await render(true)
    const controls = html.split('data-testid="help-controls"')[1]!.split('</dl>')[0]!
    const rows = [...controls.matchAll(/<dt[^>]*>([^<]*)<\/dt><dd[^>]*>([^<]*)<\/dd>/g)]
    expect(rows.slice(-2).map((m) => [m[1], m[2]])).toEqual([
      ['O', 'Overlay Bodenqualität ein / aus'],
      ['Z', 'Overlay Lagen ein / aus'],
    ])
  })
})
