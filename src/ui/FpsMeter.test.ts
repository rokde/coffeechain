import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useViewStore } from '../app/view'
import Hud from './Hud.vue'

vi.stubGlobal('location', { search: '?seed=42' })
vi.stubGlobal('sessionStorage', { getItem: () => null, removeItem: () => {} })

async function render(visible: boolean, help = false) {
  const pinia = createPinia()
  const view = useViewStore(pinia)
  view.fpsVisible = visible
  view.fps = 60
  view.helpOpen = help
  return renderToString(createSSRApp(Hud).use(pinia))
}

describe('FpsMeter (S54)', () => {
  it('AC-5: the Hud shows the meter only when fpsVisible is true', async () => {
    expect(await render(false)).not.toContain('fps-meter')
    const html = await render(true)
    expect(html).toContain('data-testid="fps-meter"')
    expect(html.split('data-testid="fps-meter"')[1]).toMatch(/^[^>]*>60 fps</)
  })

  it('AC-5: the help overlay lists the F key', async () => {
    const controls = (await render(false, true))
      .split('data-testid="help-controls"')[1]!
      .split('</dl>')[0]!
    expect(controls).toMatch(/<dt[^>]*>F<\/dt><dd[^>]*>Bildrate \(fps\) zeigen \/ verbergen/)
  })
})
