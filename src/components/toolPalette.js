export const COLORS = {
  gold: '#E8C84A',
  goldBright: '#FFF0A8',
  silver: '#D4D8DC',
  silverBright: '#FFFFFF',
  lilac: '#C8B6E8',
  lilacBright: '#EADFFF',
  rose: '#E0A9B8',
  roseBright: '#FFD9E4',
  neonCyan: '#7FD4FF',
  fieldEdge: '#E6C891',
  calcGold: '#E6C891',
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`
}
