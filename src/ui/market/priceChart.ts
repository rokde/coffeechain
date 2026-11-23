// The price chart has a fixed scale: 50 to 150 % of the reference price.
export const SCALE = { min: 0.5, max: 1.5 } as const

// Share of the reference, held on the scale.
export const share = (price: number, reference: number) =>
  Math.min(SCALE.max, Math.max(SCALE.min, price / reference))

// y of a price in a plot that starts at top and is height tall: 150 % at the top, 50 % at the bottom.
export const chartY = (price: number, reference: number, top: number, height: number) =>
  top + ((SCALE.max - share(price, reference)) / (SCALE.max - SCALE.min)) * height
