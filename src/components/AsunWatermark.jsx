// Watermark de estado vacío de Asun (LLM / Música).
export default function AsunWatermark({ category, isIrmaMax }) {
  const accent = isIrmaMax ? '#FA7A9A' : '#DF9CFF'
  return (
    <div className="asun-watermark" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      flex: 1, padding: '40px 20px', gap: 10,
      userSelect: 'none', pointerEvents: 'none',
    }}>
      <div className="watermark-brand" style={{ color: accent, fontSize: '1.5rem' }}>R7SIGNAL</div>
      <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
      <div className="watermark-name" style={{ color: accent, fontSize: '1.9rem' }}>ASUN</div>
      <div className="watermark-sub" style={{ color: accent, fontSize: '0.8rem' }}>
        {category === 'llm'
          ? <>Asun es un agente diseñado para conversar, generar imágenes y música.<br />
Tiene dos modos de conversación según lo que necesites.<br />
Las imágenes y la música se generan <br />
con modelos aptos y testeados para cada tipo de contenido.<br />
Asun puede leer y escribir dentro de su propia área de trabajo,<br />
siempre con tu confirmación antes de borrar o sobreescribir algo.<br />
Si necesitas administrar archivos o generar código,<br />
ese trabajo es de Cochi — cambia de panel y decile qué necesitás.<br />
La función Proyecto activa un modo de planificación:<br />
Asun entrevista la tarea y arma un plan segmentado<br />
para que lo ejecuten Cochi, TITO y el propio Asun en modo Standard.<br />
Cuando necesites empezar de cero, usa el botón CLS al pie del Panel;<br />
limpiará el chat por completo, sin dejar rastro.<br />
A los 70.000 tokens aparecerá R7 para guardar tus avances.<br />
R7 creará un resumen de la tarea junto al último mensaje.<br />
Y si preferís conservar solo fragmentos específicos o líneas de código,<br />
R9 te permitirá seleccionarlos con total precisión —<br />
o simplemente pedile a Asun que guarde lo último en un txt.<br />
Encontrarás el contenido de R7 y R9 en el compartimento<br />
junto a la rueda dentada.<br />
<br />
NOTA: Asun tiene incorporado un tono de personalidad específico vía prompt<br />
que no es posible cambiar en esta versión.<br />
RGartner by R7Signal</>
          : <>Cuéntale a Asun tu estilo musical.<br />Cuando tenga el concepto, genera con Lyria.</>}
      </div>
    </div>
  )
}
