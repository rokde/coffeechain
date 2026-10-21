// Amounts are in hundredths of CC. A booking moves only whole CC (PRD §12 row 8).
// Costs round up and income rounds down, so a split booking never gives money.
export const roundCost = (cents: number) => Math.ceil(cents / 100) * 100
export const roundIncome = (cents: number) => Math.floor(cents / 100) * 100
