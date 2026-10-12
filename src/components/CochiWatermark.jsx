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
      <div className="watermark-name" style={{ color: accent, fontSize: '1.9rem' }}>COCHI</div>
      <div className="watermark-sub" style={{ color: accent, fontSize: '0.8rem' }}>
      Cochi is an agent built to manage your files and your code.<br />
It has two selectors designed to balance <br />
speed and capacity for the demands of each task.<br />
You can also run Cochi <br />
on your own local models via Ollama or LM Studio.<br />
With your authorization, Cochi manages files and code <br />
from the Workspace window in the header.<br />
Sensitive operations —deletion, overwriting—<br />
always require your explicit confirmation. None runs without it.<br />
      The CLS button, at the foot of the Panel, <br />
      purges the chat and restarts the operation from scratch.<br />
At 70,000 tokens, R7 saves a summary of the task next to the last message.<br />
R9 lets you select individual paragraphs or code fragments <br />
to extract specific data.<br />
The content of R7 and R9 lives <br />
in the compartment next to the gear wheel.<br />
<br />
NOTE: Cochi has a specific personality tone built into its prompt<br />
that cannot be changed in this version. <br />
RGartner by R7Signal
      </div>
    </div>
  )
}
