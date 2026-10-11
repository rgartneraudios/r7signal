import {
  NOTE_NAMES, CHORD_TYPES, CHORD_GROUPS, channelDef,
  chordLabel, describeChord, midiToName, noteToMidi, percLabel,
} from '../lib/sequencer'

const OCTAVES = [1, 2, 3, 4, 5, 6]
const DEFAULT_CHORD = { root: 'C', type: 'maj' }

function ChordSelectors({ chord, onChange }) {
  return (
    <div className="seq-insp-row">
      <label className="seq-insp-field">
        <span>Tónica</span>
        <select className="seq-select" value={chord.root} onChange={e => onChange({ ...chord, root: e.target.value })}>
          {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      <label className="seq-insp-field">
        <span>Tipo de acorde</span>
        <select className="seq-select" value={chord.type} onChange={e => onChange({ ...chord, type: e.target.value })}>
          {CHORD_GROUPS.map(g => (
            <optgroup key={g} label={g}>
              {CHORD_TYPES.filter(c => c.group === g).map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
    </div>
  )
}

function SelectionEditor({ channel, block, globalChord, onChange }) {
  const kind = channelDef(channel).kind

  if (kind === 'chord') {
    const chord = block.chord || globalChord
    const usingGlobal = !block.chord
    return (
      <>
        <ChordSelectors chord={chord} onChange={next => onChange({ chord: next })} />
        <div className="seq-preview">{chordLabel(chord.root, chord.type)} = {describeChord(chord)}</div>
        <div className="seq-insp-actions">
          <button
            type="button"
            className="seq-mini"
            disabled={usingGlobal}
            onClick={() => onChange({ chord: null })}
          >
            Usar acorde global
          </button>
        </div>
      </>
    )
  }

  if (kind === 'note') {
    const { name, octave } = midiToName(block.midi)
    return (
      <div className="seq-insp-row">
        <label className="seq-insp-field">
          <span>Nota</span>
          <select className="seq-select" value={name} onChange={e => onChange({ midi: noteToMidi(e.target.value, octave) })}>
            {NOTE_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="seq-insp-field">
          <span>Octava</span>
          <select className="seq-select" value={octave} onChange={e => onChange({ midi: noteToMidi(name, Number(e.target.value)) })}>
            {OCTAVES.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>
    )
  }

  return (
    <div className="seq-preview">{percLabel(channelDef(channel).voice)} · sonido fijo</div>
  )
}

export default function SequencerInspector({ pattern, selected, selectedBlock, onPadChord, onUpdateSelected, onDeselect }) {
  const globalChord = pattern.padChord || DEFAULT_CHORD

  return (
    <div className="seq-inspector">
      <div className="seq-panel">
        <div className="seq-insp-title">Acorde global · Pad</div>
        <ChordSelectors chord={globalChord} onChange={onPadChord} />
        <div className="seq-preview">{chordLabel(globalChord.root, globalChord.type)} = {describeChord(globalChord)}</div>
        <div className="seq-hint">
          Los pads nuevos usan este acorde. Clic derecho en una celda del Pad para sobrescribirla.
        </div>
      </div>

      <div className="seq-panel">
        <div className="seq-insp-title">
          <span>Selección</span>
          {selected && (
            <button type="button" className="seq-mini" onClick={onDeselect}>Quitar</button>
          )}
        </div>
        {!selected || !selectedBlock ? (
          <div className="seq-hint">
            Clic derecho sobre una celda para editar su nota o acorde. Arrastrá sobre la grilla para
            extender la duración.
          </div>
        ) : (
          <SelectionEditor
            channel={selected.channel}
            block={selectedBlock}
            globalChord={globalChord}
            onChange={onUpdateSelected}
          />
        )}
      </div>
    </div>
  )
}
