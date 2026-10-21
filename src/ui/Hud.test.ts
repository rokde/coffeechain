import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useFirstStepsStore } from '../app/firstSteps'
import { useGameStore } from '../app/store'
import { useViewStore } from '../app/view'
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

describe('Hud left panel (S59)', () => {
  const left = async (pinia: ReturnType<typeof createPinia>) =>
    (await renderToString(createSSRApp(Hud).use(pinia)))
      .split('data-testid="hud-left-panel"')[1]!
      .split('</aside>')[0]!

  it('AC-4: open first steps hide the field list, a close shows it', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    let h = await left(pinia)
    expect(h).toContain('data-testid="first-steps"')
    expect(h).not.toContain('field-list')
    useFirstStepsStore(pinia).open = false
    h = await left(pinia)
    expect(h).toContain('data-testid="field-list"')
    expect(h).not.toContain('first-steps')
  })

  it('AC-4: the field list replaces the open checklist when all steps are done', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const game = useGameStore(pinia)
    const state = game.state as GameState
    useViewStore(pinia).toggle('soil')
    game.replace({
      ...state,
      farm: {
        ...state.farm,
        parcels: { 0: 0 },
        fields: [{ id: 0, name: 'A' }],
        plants: { 0: { variety: 'robusta', plantedHour: 0, fertilized: true } },
      },
      market: {
        ...state.market,
        volumes: [{ kind: 'coffee', variety: 'robusta', day: 1, units: 1 }],
      },
    })
    const steps = useFirstStepsStore(pinia)
    expect(steps.open).toBe(true)
    expect(steps.current.next).toBeNull()
    const h = await left(pinia)
    expect(h).toContain('data-testid="field-list"')
    expect(h).not.toContain('first-steps')
  })
})

describe('Hud overlay toggles (S60)', () => {
  const render = async (setup: (pinia: ReturnType<typeof createPinia>) => void = () => {}) => {
    const pinia = createPinia()
    setActivePinia(pinia)
    setup(pinia)
    return renderToString(createSSRApp(Hud).use(pinia))
  }
  const toolbar = (html: string) => html.split('data-testid="hud-toolbar"')[1]!.split('</nav>')[0]!
  const button = (html: string, id: string) =>
    toolbar(html).split(`data-testid="${id}"`)[1]!.split('</button>')[0]!
  const tag = (html: string, id: string) =>
    toolbar(html).match(new RegExp(`<button[^>]*data-testid="${id}"[^>]*>`))![0]

  it('AC-1: the toolbar holds a labelled group with both toggles after the nine tools', async () => {
    const html = await render()
    expect(html).not.toContain('role="switch"')
    const nav = toolbar(html)
    const group = nav.split('role="group"')[1]!
    expect(nav).toMatch(/<div[^>]*role="group"[^>]*aria-label="Karten-Overlays"/)
    const ids = [...nav.matchAll(/data-testid="((?:tool|overlay)-[^"]+)"/g)].map((m) => m[1])
    expect(ids.slice(0, 9).every((id) => id!.startsWith('tool-'))).toBe(true)
    expect(ids.slice(9)).toEqual(['overlay-soil', 'overlay-zone'])
    expect(group).toContain('data-testid="overlay-soil"')
    expect(group).toContain('data-testid="overlay-zone"')
    for (const [id, label, title, key] of [
      ['overlay-soil', 'Boden', 'Bodenqualität (O)', 'O'],
      ['overlay-zone', 'Lagen', 'Lagen (Z)', 'Z'],
    ] as const) {
      expect(tag(html, id)).toContain(`title="${title}"`)
      expect(tag(html, id)).toContain(`aria-keyshortcuts="${key}"`)
      expect(button(html, id)).toMatch(/<svg[^>]*aria-hidden="true"/)
      expect(button(html, id)).toMatch(new RegExp(`<span[^>]*>${label}</span>`))
    }
  })

  it('AC-2: aria-pressed follows the one overlay that is on', async () => {
    const pressed = async (overlay: 'none' | 'soil' | 'zone') => {
      const html = await render((pinia) => (useViewStore(pinia).overlay = overlay))
      return ['overlay-soil', 'overlay-zone'].map(
        (id) => tag(html, id).match(/aria-pressed="(\w+)"/)![1],
      )
    }
    expect(await pressed('none')).toEqual(['false', 'false'])
    expect(await pressed('soil')).toEqual(['true', 'false'])
    expect(await pressed('zone')).toEqual(['false', 'true'])
  })

  it('AC-4: the soil toggle in the toolbar is the first-steps target, the legend shows only with an overlay', async () => {
    let html = await render((pinia) => useFirstStepsStore(pinia))
    expect(tag(html, 'overlay-soil')).toContain('data-guide="next"')
    expect(html).not.toContain('overlay-legend')
    expect(html).not.toContain('hud-overlay-panel')
    html = await render((pinia) => useViewStore(pinia).toggle('soil'))
    expect(html).toContain('data-testid="overlay-legend"')
    expect(html).toContain('Dunkler Boden')
    html = await render((pinia) => useViewStore(pinia).toggle('zone'))
    expect(html).toContain('data-testid="overlay-legend"')
    expect(html).not.toContain('Dunkler Boden')
  })
})
