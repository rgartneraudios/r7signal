// Watermark de estado vacío de Tito.
export default function TitoWatermark() {
  return (
    <div className="tito-watermark">
      <div className="watermark-brand" style={{ fontSize: '1.5rem' }}>R7SIGNAL</div>
      <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
      <div className="watermark-name" style={{ fontSize: '1.9rem' }}>TITUS 7R / SEARCH</div>
      <div className="watermark-sub" style={{ fontSize: '0.8rem' }}>TITUS-7R es la unidad de búsqueda y telemetría de R7Signal,<br />
con búsqueda web real integrada vía DeepSeek V4 Flash.<br />
Una sola pestaña: no hay selectores de nivel.<br />
TITUS-7R no administra archivos ni código — para eso está Cochi.<br />
El botón CLS, al pie del Panel, limpia el chat<br />
y reinicia la búsqueda desde cero.<br />
A los 70.000 tokens aparece el botón Compactar contexto,<br />
que resume los turnos viejos localmente (sin llamar al modelo).<br />
Y si solo necesitás fragmentos puntuales <br />
párrafos sueltos o pedazos de código, <br />
R9 permite seleccionarlos con precisión.<br />
El contenido de R7 y R9 se encuentra en el compartimento<br />
junto a la rueda dentada.<br />
<br />
NOTA: TITUS-7R tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión.<br />
RGartner by R7Signal
      </div>
    </div>
  )
}
