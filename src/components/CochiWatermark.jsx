// Watermark de estado vacío de Cochi.
export default function CochiWatermark({ isTerminator }) {
  const accent = isTerminator ? '#C1C4C9' : '#E3B5A3'
  return (
    <div className="cochi-watermark" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: '40px 20px', gap: 10, userSelect: 'none', pointerEvents: 'none',
    }}>
      <div className="watermark-brand" style={{ color: accent, fontSize: '1.5rem' }}>R7SIGNAL</div>
      <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
      <div className="watermark-name" style={{ color: accent, fontSize: '1.9rem' }}>COCHI DESKTOP</div>
      <div className="watermark-sub" style={{ color: accent, fontSize: '0.8rem' }}>
      Cochi es un agente diseñado para administrar tus archivos y tu código.<br />
Tiene dos selectores con dos modelos distintos : <br />
Centinela para tareas técnicas cotidianas,<br />
Terminator para decisiones de mayor calibre.<br />
Ambos modelos fueron seleccionados conscientemente <br />
para equilibrar velocidad y capacidad según la exigencia de cada tarea.<br />
También puedes operar a Cochi <br />
con tus propios modelos locales vía Ollama o LM Studio.<br />
Con tu autorización, Cochi administra archivos y código <br />
desde la ventana Workspace en la cabecera.<br />
Las operaciones sensibles —borrado, sobreescritura—<br />
requieren siempre tu confirmación explícita. Ninguna se ejecuta sin ella.<br />
El botón CLS, en la base del Panel, <br />
purga el chat y reinicia la operación desde cero.<br />
A los 70.000 tokens, R7 guarda un resumen de la tarea junto al último mensaje.<br />
R9 permite seleccionar puntualmente párrafos o fragmentos de código <br />
para extraer datos específicos.<br />
El contenido de R7 y R9 se encuentra <br />
en el compartimento junto a la rueda dentada.<br />
<br />
NOTA: Cochi tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión. <br />
RGartner by R7Signal
      </div>
    </div>
  )
}
