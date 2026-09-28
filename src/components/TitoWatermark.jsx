// Watermark de estado vacío de Tito.
export default function TitoWatermark() {
  return (
    <div className="tito-watermark">
      <div className="watermark-brand" style={{ fontSize: '1.5rem' }}>R7SIGNAL</div>
      <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
      <div className="watermark-name" style={{ fontSize: '1.9rem' }}>TITO RESEARCH</div>
      <div className="watermark-sub" style={{ fontSize: '0.8rem' }}>Tito es un agente especializado en buscar información,<br />
con modelos de Perplexity en distintos niveles<br />
según la profundidad que necesite tu búsqueda.<br />
Selecciona el nivel de búsqueda en los selectores del Panel.<br />
Tito no administra archivos ni código — para eso está Cochi.<br />
El botón CLS, al pie del Panel, limpia el chat<br />
y reinicia la búsqueda desde cero.<br />
A los 70.000 tokens aparece R7 para guardar el resumen<br />
de la tarea junto al último mensaje.<br />
Y si solo necesitás fragmentos puntuales <br />
párrafos sueltos o pedazos de código, <br />
R9 permite seleccionarlos con precisión.<br />
El contenido de R7 y R9 se encuentra en el compartimento<br />
junto a la rueda dentada.<br />
<br />
NOTA: Tito tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión.<br />
RGartner by R7Signal
      </div>
    </div>
  )
}
