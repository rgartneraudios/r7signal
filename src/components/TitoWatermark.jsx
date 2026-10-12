// Watermark de estado vacío de Tito.
export default function TitoWatermark() {
  return (
    <div className="tito-watermark">
      <div className="watermark-brand" style={{ fontSize: '1.5rem' }}>R7SIGNAL</div>
      <div className="watermark-divider" style={{ fontSize: '0.7rem' }}>────────────────</div>
      <div className="watermark-name" style={{ fontSize: '1.9rem' }}>TITO</div>
      <div className="watermark-sub" style={{ fontSize: '0.8rem' }}>TITO is the search and telemetry unit of R7Signal,<br />
with real web search integrated.<br />
A single tab: there are no level selectors.<br />
TITO does not manage files or code — that is Cochi's job.<br />
The CLS button, at the foot of the Panel, clears the chat<br />
and restarts the search from scratch.<br />
At 70,000 tokens the Compact Context button appears,<br />
summarizing old turns locally (without calling the model).<br />
And if you only need specific fragments, <br />
loose paragraphs or code snippets, <br />
R9 lets you select them with precision.<br />
The content of R7 and R9 lives in the compartment<br />
next to the gear wheel.<br />
<br />
NOTE: TITO has a specific personality tone built into its prompt<br />
that cannot be changed in this version.<br />
RGartner by R7Signal
      </div>
    </div>
  )
}
