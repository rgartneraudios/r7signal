const FACES = [
  { transform: 'rotateY(0deg) translateZ(42px)',   glow: '#E8C84A' },
  { transform: 'rotateY(90deg) translateZ(42px)',  glow: '#C8B6E8' },
  { transform: 'rotateY(180deg) translateZ(42px)', glow: '#D4D8DC' },
  { transform: 'rotateY(-90deg) translateZ(42px)', glow: '#E0A9B8' },
]

const KEYFRAMES = `
  @keyframes holoPrismSpin { from { transform: rotateY(0deg); } to { transform: rotateY(360deg); } }
`

export default function HoloPrism({ images = [], activeIndex = -1, style }) {
  return (
    <div style={{
      perspective: '1100px', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      <style>{KEYFRAMES}</style>
      <div style={{
        position: 'relative', width: '60%', aspectRatio: '2 / 3.3',
        transformStyle: 'preserve-3d',
        animation: 'holoPrismSpin 22s linear infinite',
      }}>
        {FACES.map((face, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', inset: 0, borderRadius: 14, overflow: 'hidden',
              border: `2px solid ${face.glow}`, transform: face.transform,
              background: 'linear-gradient(150deg, #1A191E 0%, #0D0C10 100%)',
              boxShadow: i === activeIndex
                ? `0 0 30px ${face.glow}, 0 0 60px ${face.glow}`
                : '0 0 14px rgba(0,0,0,0.6)',
            }}
          >
            {images[i] && (
              <img
                src={images[i]}
                alt={`Cara ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}