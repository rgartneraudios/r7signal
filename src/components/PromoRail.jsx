import HoloPrism from './HoloPrism'
import { BRO7VISION_URL } from '../lib/webRoutes'
import { COLORS, rgba } from './toolPalette'

const HOLO_IMAGES = [
  '/assets/holoPrisma1.webp',
  '/assets/holoPrisma2.webp',
  '/assets/holoPrisma3.webp',
  '/assets/holoPrisma4.webp',
]

const DIGITAL_PRODUCTS = [
  { src: '/assets/digitales1.webp', tag: 'eBook', title: 'Colección R7' },
  { src: '/assets/digitales2.webp', tag: 'eBook', title: 'Atlas Digital' },
  { src: '/assets/digitales3.webp', tag: 'eBook', title: 'Manual Premium' },
  { src: '/assets/digitales4.webp', tag: 'eBook', title: 'Edición Diamante' },
  { src: '/assets/digitales5.webp', tag: 'eBook', title: 'Serie Lujo' },
]

const CARD_STYLE = {
  position: 'relative', width: '100%', aspectRatio: '2 / 3',
  borderRadius: 18, overflow: 'hidden',
  border: '1px solid rgba(212,216,220,0.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 18px 44px rgba(0,0,0,0.78)',
  background: '#131215',
}

function HoloCard() {
  return (
    <div className="lux-card" style={{
      ...CARD_STYLE,
      background: `radial-gradient(ellipse at 50% 18%, ${rgba(COLORS.lilac, 0.14)} 0%, transparent 62%), linear-gradient(165deg, #17161C 0%, #0B0A0D 100%)`,
      borderColor: rgba(COLORS.lilac, 0.35),
    }}>
      <HoloPrism images={HOLO_IMAGES} style={{ position: 'absolute', inset: 0 }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 16px',
        background: 'linear-gradient(180deg, transparent 0%, rgba(8,7,10,0.9) 100%)',
        textAlign: 'center',
      }}>
        <a href={BRO7VISION_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: '0.58rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: COLORS.lilacBright, fontWeight: 700, textShadow: `0 0 12px ${rgba(COLORS.lilac, 0.6)}` }}>
            Visítanos!
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 800, letterSpacing: '0.06em', color: COLORS.silverBright, marginTop: 6 }}>
            www.bro7vision.com
          </div>
        </a>
      </div>
    </div>
  )
}

function DigitalCard({ src, tag, title }) {
  return (
    <div className="lux-card" style={CARD_STYLE}>
      <img src={src} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(10,9,12,0.04) 0%, rgba(10,9,12,0.12) 52%, rgba(8,7,10,0.94) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '16px 16px 18px' }}>
        <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: COLORS.goldBright, fontWeight: 700, textShadow: `0 0 12px ${rgba(COLORS.gold, 0.5)}` }}>
          {tag}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.03em', color: COLORS.silverBright, marginTop: 6 }}>
          {title}
        </div>
        <div style={{ height: 2, width: 42, marginTop: 10, background: `linear-gradient(90deg, ${COLORS.gold}, transparent)`, boxShadow: `0 0 10px ${rgba(COLORS.gold, 0.6)}` }} />
      </div>
    </div>
  )
}

function Column({ children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{children}</div>
}

export function PromoRail({ side = 'left' }) {
  const items = side === 'left'
    ? [<HoloCard key="holo" />, <DigitalCard key="d0" {...DIGITAL_PRODUCTS[0]} />, <DigitalCard key="d1" {...DIGITAL_PRODUCTS[1]} />]
    : DIGITAL_PRODUCTS.slice(2).map((p, i) => <DigitalCard key={`d${i + 2}`} {...p} />)
  return <Column>{items}</Column>
}

const TOOL_CSS = `
  .lux-card { transition: transform .25s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, border-color .25s ease; }
  .lux-card:hover {
    transform: translateY(-4px);
    border-color: rgba(232,200,74,0.55);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 54px rgba(0,0,0,0.85), 0 0 26px rgba(232,200,74,0.18);
  }
  .calc-num, .calc-result {
    width: 100%; box-sizing: border-box;
    background: linear-gradient(180deg, #0B0A0D 0%, #131216 100%);
    border: 1px solid rgba(212,216,220,0.22); border-radius: 12px;
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif;
    font-size: 1.45rem; font-weight: 800; letter-spacing: 0.02em;
    padding: 12px 14px; outline: none;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75);
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .calc-num::placeholder { color: #5A585C; font-weight: 500; }
  .calc-num option { background: #141316; color: #E8E6EC; }
  .calc-num:focus {
    border-color: ${COLORS.fieldEdge};
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 20px ${rgba(COLORS.fieldEdge, 0.5)};
  }
  .calc-result {
    color: ${COLORS.goldBright};
    border-color: ${COLORS.fieldEdge};
    background: linear-gradient(180deg, #14110A 0%, #100E0C 100%);
    text-shadow: 0 0 12px ${rgba(COLORS.gold, 0.5)};
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 20px ${rgba(COLORS.fieldEdge, 0.28)};
  }
  .calc-result-empty { color: #5A585C; font-weight: 500; text-shadow: none; }
  .tool-scroll::-webkit-scrollbar { width: 10px; }
  .tool-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); border-radius: 8px; }
  .tool-scroll::-webkit-scrollbar-thumb { background: #2A2930; border-radius: 8px; border: 2px solid #0F0E11; }
  .tool-scroll::-webkit-scrollbar-thumb:hover { background: #3A3942; }
`

export function ToolPage({ children }) {
  return (
    <div className="tool-scroll" style={{
      position: 'absolute', inset: '126px 32px 58px 32px', zIndex: 20,
      overflowY: 'auto', overflowX: 'hidden', paddingRight: 8,
    }}>
      <style>{TOOL_CSS}</style>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(190px, 22%) 1fr minmax(190px, 22%)',
        gap: 24, alignItems: 'start',
      }}>
        <PromoRail side="left" />
        <Column>{children}</Column>
        <PromoRail side="right" />
      </div>
    </div>
  )
}
