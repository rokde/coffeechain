import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

describe('Tauri config', () => {
  const conf = JSON.parse(read('src-tauri/tauri.conf.json'))

  it('names the app and points at the Vite build', () => {
    expect(conf.productName).toBe('CoffeeChain')
    expect(conf.identifier).toBe('de.rokde.coffeechain')
    expect(conf.app.windows[0].title).toBe('CoffeeChain')
    expect(conf.build).toMatchObject({
      devUrl: 'http://localhost:5173',
      frontendDist: '../dist',
      beforeDevCommand: 'npm run dev',
      beforeBuildCommand: 'npm run build',
    })
    expect(conf.bundle.targets).toEqual(['app'])
  })
})

describe('CI workflow', () => {
  const ci = read('.github/workflows/ci.yml')
  // Splits the jobs block into one text chunk per job; plain string checks, no YAML parser.
  const jobs = ci
    .split(/^jobs:$/m)[1]!
    .split(/^ {2}(?=\w)/m)
    .filter((job) => job.trim())
  const job = (runner: string) => jobs.find((text) => text.includes(`runs-on: ${runner}`)) ?? ''

  it('runs on push and pull_request with read-only permissions', () => {
    expect(ci).toMatch(/^ {2}push:/m)
    expect(ci).toMatch(/^ {2}pull_request:/m)
    expect(ci).toMatch(/permissions:\n {2}contents: read/)
  })

  it('checks the web build on Ubuntu', () => {
    const web = job('ubuntu-latest')
    const steps = ['npm ci', 'npm run lint', 'npm run typecheck', 'npm test', 'npm run build']
    for (const step of steps) expect(web).toContain(`- run: ${step}\n`)
    expect(web).toContain('node-version: 24')
  })

  it('builds the Mac app on macOS', () => {
    const mac = job('macos-latest')
    expect(mac).toContain('dtolnay/rust-toolchain@stable')
    expect(mac).toContain('- run: npm ci\n')
    expect(mac).toContain('- run: npm run tauri build\n')
  })
})
