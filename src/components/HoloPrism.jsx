const DEFAULT_IMGS = [
  "/images/prism_1.jpg",
  "/images/prism_2.jpg", 
  "/images/prism_3.jpg",
  "/images/prism_4.jpg"
];

const FACES = [
  { transform: 'translateZ(40px)',        borderColor: 'border-cyan-500',    glow: '#00E5FF', rot: 0   },
  { transform: 'rotateY(180deg) translateZ(40px)', borderColor: 'border-fuchsia-500', glow: '#FF2EF7', rot: 180 },
  { transform: 'rotateY(90deg) translateZ(40px)',  borderColor: 'border-yellow-500',  glow: '#FFD000', rot: 90  },
  { transform: 'rotateY(-90deg) translateZ(40px)', borderColor: 'border-green-500',   glow: '#00FF88', rot: -90 },
];

const HoloPrism = ({ 
  user,           // modo individual — 4 imgs del mismo comercio
  comercios,      // modo plural — 1 img de cada comercio (array de hasta 4)
  activeIndex,    // cara activa iluminada por Mapache
  showNumbers,    // mostrar números neon encima
  className = ''  // para posicionamiento externo
}) => {

  // Resolver imágenes según modo
  let images = DEFAULT_IMGS;
  let labels = ['1', '2', '3', '4'];

  if (comercios && comercios.length > 0) {
    // MODO PLURAL — 1 imagen por comercio
    images = comercios.map(c => 
      c.banner_url || c.avatar_url || DEFAULT_IMGS[0]
    );
    labels = comercios.map((_, i) => String(i + 1));
  } else if (user) {
    // MODO INDIVIDUAL — 4 imgs del mismo comercio
    if (user.holo_images && Array.isArray(user.holo_images)) {
      images = user.holo_images;
    } else if (user.holo_1 || user.holo_2 || user.holo_3 || user.holo_4) {
      images = [
        user.holo_1 || DEFAULT_IMGS[0],
        user.holo_2 || DEFAULT_IMGS[1],
        user.holo_3 || DEFAULT_IMGS[2],
        user.holo_4 || DEFAULT_IMGS[3]
      ];
    }
  }

  return (
    <div className={`perspective-[1000px] ${className}`}>
     <div 
  className="relative animate-spin-slow-3d" 
  style={{ 
    transformStyle: 'preserve-3d',
    width: '200px',    // ← antes w-48 = 192px
    height: '340px',   // ← antes h-80 = 320px
  }}
>

        {FACES.map((face, index) => {
          const isActive = activeIndex === index;
          const img = images[index] || DEFAULT_IMGS[index];
          
          return (
            <div
              key={index}
              className={`absolute inset-0 bg-black/20 border-2 ${face.borderColor} overflow-hidden`}
              style={{ 
                transform: face.transform,
                overflow: 'visible',
                boxShadow: isActive 
                  ? `0 0 30px ${face.glow}, 0 0 60px ${face.glow}` 
                  : '0 0 15px rgba(0,0,0,0.5)',
                transition: 'box-shadow 0.3s ease'
              }}
            >
              <img 
                src={img} 
                alt={`Comercio ${index + 1}`} 
                className="w-full h-full object-cover opacity-100" 
              />

              {showNumbers && (
  <div style={{
    position: 'absolute',
    top: -30,          // ← encima de la cara, no dentro
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: 52,
    fontWeight: 900,
    fontFamily: 'Chakra Petch, sans-serif',
    color: face.glow,
    textShadow: `0 0 10px ${face.glow}, 0 0 25px ${face.glow}`,
    zIndex: 10,
  }}>
    {labels[index]}
  </div>
)}

              {/* Nombre del comercio abajo — solo en modo plural */}
              {comercios && comercios[index] && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: '8px 6px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'Rajdhani, sans-serif',
                  color: '#fff',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {comercios[index].alias}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HoloPrism;