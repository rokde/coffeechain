import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useViewStore } from '../app/view'
import { balance } from '../sim/balance'
import de from './i18n/de.json'
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
    expect(tools).toHaveLength(8)
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

describe('help: buildings and washing (S62)', () => {
  const section = (html: string, id: string) =>
    html.split(`data-testid="${id}"`)[1]!.split('</ol>')[0]!

  it('AC-1: the sections follow help-loop and precede help-controls with the real labels', async () => {
    const html = await render(true)
    const at = (id: string) => html.indexOf(`data-testid="${id}"`)
    expect(at('help-loop')).toBeLessThan(at('help-washing'))
    expect(at('help-washing')).toBeLessThan(at('help-storage'))
    expect(at('help-storage')).toBeLessThan(at('help-controls'))
    expect(html).toContain('Kaffee waschen')
    expect(html).toContain('Lager ausbauen')
    const washing = section(html, 'help-washing')
    const labels = [
      'Auswählen',
      de.buildTool.heading,
      de.buildTool.buildings.processing,
      de.marketPanel.heading,
      de.marketPanel.process,
      de.marketPanel.sellWashed,
    ]
    for (const label of labels) expect(washing).toContain(label)
    expect(washing).toContain(de.marketPanel.processing.replace('{day}', 'N'))
    expect(section(html, 'help-storage')).toContain(de.buildTool.buildings.storage)
  })

  it('AC-2: the washing section shows the default values', async () => {
    const washing = section(await render(true), 'help-washing')
    for (const text of [
      '150 CC',
      'Phase 1',
      '50 Einheiten',
      '0,3 CC je Einheit',
      '1 Tag.',
      'das 1,5-Fache',
      'ab etwa 0,6 CC',
    ])
      expect(washing).toContain(text)
  })

  it('AC-2/AC-3: the sections follow a changed config', async () => {
    const base = balance()
    const changed = {
      ...base,
      processing: {
        washed: {
          ...base.processing.washed,
          buildCost: 275,
          requiresPhase: 3,
          batchCapacity: 70,
          costPerUnit: 0.4,
          durationDays: 2,
          valueMultiplier: 1.8,
        },
      },
      storage: {
        ...base.storage,
        startCapacity: 80,
        costPerUnitPerDay: 0.1,
        qualityLossPerDayRaw: 3,
        upgrades: [
          { capacity: 111, cost: 11, requiresPhase: 1 },
          { capacity: 222, cost: 22, requiresPhase: 2 },
          { capacity: 333, cost: 33, requiresPhase: 4 },
        ],
      },
    }
    vi.resetModules()
    vi.doMock('../sim/balance', () => ({ balance: () => changed }))
    const { default: HudMocked } = await import('./Hud.vue')
    const { useViewStore: useView } = await import('../app/view')
    const pinia = createPinia()
    useView(pinia).helpOpen = true
    const html = await renderToString(createSSRApp(HudMocked).use(pinia))
    vi.doUnmock('../sim/balance')
    const washing = section(html, 'help-washing')
    for (const text of [
      '275 CC',
      'Phase 3',
      '70 Einheiten',
      '0,4 CC',
      '2 Tage',
      '1,8-Fache',
      '0,5 CC',
    ])
      expect(washing).toContain(text)
    const storage = section(html, 'help-storage')
    expect(storage).toContain('80 Einheiten')
    expect(storage.match(/Stufe \d:/g)).toHaveLength(3)
    for (const text of [
      'Stufe 3: Gesamtplatz 333 Einheiten, Kosten 33 CC, ab Phase 4',
      'je angefangene 10 Einheiten',
      'Qualitätspunkten: 3',
    ])
      expect(storage).toContain(text)
  })

  it('hides the break-even step when the multiplier is 1 or less', async () => {
    const base = balance()
    const flat = {
      ...base,
      processing: { washed: { ...base.processing.washed, valueMultiplier: 1 } },
    }
    vi.resetModules()
    vi.doMock('../sim/balance', () => ({ balance: () => flat }))
    const { default: HudMocked } = await import('./Hud.vue')
    const { useViewStore: useView } = await import('../app/view')
    const pinia = createPinia()
    useView(pinia).helpOpen = true
    const html = await renderToString(createSSRApp(HudMocked).use(pinia))
    vi.doUnmock('../sim/balance')
    const washing = section(html, 'help-washing')
    expect(washing).toContain('Gewaschen verkaufen')
    expect(washing).not.toContain('Wann lohnt sich das')
    expect(washing).not.toMatch(/Infinity|NaN|-\d+ CC/)
  })

  it('S62 review: build steps name the Bauen button, harvest names the tool and key', async () => {
    const html = await render(true)
    const washing = section(html, 'help-washing')
    expect(washing).toContain('Klicke bei „Aufbereitung“ auf „Bauen“')
    expect(washing).toContain('Wähle „Ernten“ (Taste N)')
    expect(washing).toContain('Es läuft immer nur eine Aufbereitung')
    expect(washing).toContain('ab etwa 0,6 CC')
    expect(section(html, 'help-storage')).toContain('Klicke bei „Lager-Ausbau“ auf „Bauen“')
  })

  it('AC-3: the storage section shows the default values', async () => {
    const storage = section(await render(true), 'help-storage')
    for (const text of [
      '100 Einheiten',
      'Stufe 1: Gesamtplatz 250 Einheiten, Kosten 150 CC, ab Phase 1',
      'Stufe 2: Gesamtplatz 600 Einheiten, Kosten 400 CC, ab Phase 2',
      '1 CC je angefangene 50 Einheiten',
      'Qualitätspunkten: 1',
    ])
      expect(storage).toContain(text)
  })

  it('AC-4: no placeholder is left and the new texts hold no digits', async () => {
    const html = await render(true)
    const help = html.split('data-testid="help-overlay"')[1]!.split('</section>')[0]!
    expect(help).not.toMatch(/[{}]/)
    const h = de.help
    const texts = [...h.washing, h.washingPays, ...h.storage, h.storageStage, ...h.storageAfter]
    for (const text of texts) expect(text.replace(/\{\w+\}|1 CC je/g, '')).not.toMatch(/\d/)
  })
})

describe('no pest protection texts (#8)', () => {
  it('AC-5: de.json has no protect texts and the care step has no "schütze"', () => {
    expect(JSON.stringify(de)).not.toMatch(/"(protect|pestProtected|ProtectPests)"/)
    const care = de.help.loop.find((s) => s.name === 'Pflegen')!
    expect(care.text).toBe('Dünge und wässere die Pflanzen.')
  })
})
