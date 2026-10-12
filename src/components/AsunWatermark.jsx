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
          ? <>Asun is an agent built to chat, generate images and music.<br />
It has two conversation modes depending on what you need.<br />
Images and music are generated <br />
with models suited and tested for each content type.<br />
Asun can read and write inside its own work area,<br />
always with your confirmation before deleting or overwriting anything.<br />
If you need to manage files or generate code,<br />
that work is Cochi's — switch panels and tell it what you need.<br />
The Project function activates a planning mode:<br />
Asun interviews the task and builds a segmented plan<br />
for Cochi, TITO and Asun itself to execute in Standard mode.<br />
When you need to start from scratch, use the CLS button at the foot of the Panel;<br />
it clears the chat completely, leaving no trace.<br />
At 70,000 tokens R7 will appear to save your progress.<br />
R7 creates a summary of the task next to the last message.<br />
And if you would rather keep only specific fragments or lines of code,<br />
R9 will let you select them with full precision —<br />
or simply ask Asun to save the last message to a txt.<br />
You will find the content of R7 and R9 in the compartment<br />
next to the gear wheel.<br />
<br />
NOTE: Asun has a specific personality tone built into its prompt<br />
that cannot be changed in this version.<br />
RGartner by R7Signal</>
          : <>Tell Asun your musical style.<br />Once it has the concept, generate with Lyria.</>}
      </div>
    </div>
  )
}
