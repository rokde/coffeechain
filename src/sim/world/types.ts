export type Zone = 'wasser' | 'tiefland' | 'hochland' | 'hochlandKuehl' | 'vulkan'
export type SoilClass = 'karg' | 'mittel' | 'gut' | 'sehrGut'

export type Parcel = {
  x: number
  y: number
  height: number
  zone: Zone
  fertility: number
  waterRetention: number
  soilQuality: number
  soilClass: SoilClass
}

export type World = {
  seed: number
  size: number
  // Row-major: index = y * size + x.
  parcels: Parcel[]
  start: { x: number; y: number }
}
