import raw from '../../config/balance.json'
import { loadBalance, type Balance } from '../../config/balance.schema'

let cached: Balance | undefined

// Load on first use, so that main.ts can show a config error before the sim reads the config.
export const balance = (): Balance => (cached ??= loadBalance(raw))
