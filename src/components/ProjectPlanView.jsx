import { useState, useEffect, useCallback } from 'react'
import {
  listPlans,
  deletePlan,
  savePlan,
  setBlockStatus,
  resolveReplan,
  hasPendingReplan,
  planProgress,
  nextBlock,
  planBlockHandoff,
  planBoardHandoff,
  planReplanAsunHandoff,
  statusLabel,
  PLAN_STATUS,
} from '../lib/planStore.js'

const ACCENT = '#E0A85F'
const STATUS_ACCENT = {
  [PLAN_STATUS.PENDING]:     '#8A868B',
  [PLAN_STATUS.IN_PROGRESS]: '#E0A85F',
  [PLAN_STATUS.DONE]:        '#7FD1A8',
}
const STATUS_ORDER = [PLAN_STATUS.PENDING, PLAN_STATUS.IN_PROGRESS, PLAN_STATUS.DONE]

// Bloque E2 — tablero del PLAN de proyecto (artefacto de Asun en Modo Proyecto).
// Vista del drawer: define (Asun) y estado (aquí el usuario lo marca a mano; en
// E3 Cochi lo actualizará con setBlockStatus). El handoff a Cochi es un ATAJO:
// manda el bloque canónico (planBlockHandoff), nunca el plan en prosa.
export default function ProjectPlanView({ onSendToCochi, onSendToAsun, onClose, onCountChange }) {
  const [plans, setPlans] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listPlans()
      setPlans(list)
      onCountChange?.(list.length)
      setSelectedId(prev => (prev && list.some(p => p.id === prev)) ? prev : (list[0]?.id ?? null))
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const plan = plans.find(p => p.id === selectedId) || null
  const progress = plan ? planProgress(plan) : null
  const current = plan ? nextBlock(plan) : null

  async function changeStatus(blockId, status) {
    if (!plan || busy) return
    setBusy(true)
    try {
      const updated = setBlockStatus(plan, blockId, status, { author: 'user' })
      await savePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Bloque E4: el usuario arbitra la propuesta de re-plan de Cochi.
  async function resolve(blockId, resolution) {
    if (!plan || busy) return
    setBusy(true)
    try {
      const updated = resolveReplan(plan, blockId, resolution, { author: 'user' })
      await savePlan(updated)
      setPlans(prev => prev.map(p => (p.id === updated.id ? updated : p)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Bloque E4: "Que Asun amende". Se descarta la propuesta y se envía a Asun el
  // texto para que redefina el bloque (Asun re-guarda sólo lo que cambia).
  function askAsun(blockId) {
    if (!plan) return
    const payload = planReplanAsunHandoff(plan, blockId)
    if (!payload) return
    onSendToAsun?.(payload.content)
    resolve(blockId, 'dismissed')
    onClose?.()
  }

  async function handleDelete() {
    if (!plan) return
    if (!window.confirm(`¿Borrar el plan "${plan.title}" del tablero?`)) return
    const ok = await deletePlan(plan.id)
    if (ok) {
      const next = plans.filter(p => p.id !== plan.id)
      setPlans(next)
      setSelectedId(next[0]?.id ?? null)
      onCountChange?.(next.length)
    }
  }

  function send(blockId) {
    if (!plan) return
    const payload = planBlockHandoff(plan, blockId)
    if (!payload) return
    onSendToCochi?.(payload)
    onClose?.()
  }

  function sendBoard() {
    if (!plan) return
    const payload = planBoardHandoff(plan)
    if (!payload) return
    onSendToCochi?.(payload)
    onClose?.()
  }

  if (loading) {
    return <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30 }}>Cargando planes…</div>
  }

  if (plans.length === 0) {
    return (
      <div style={{ color: '#6B7075', fontSize: '0.8rem', textAlign: 'center', marginTop: 30, lineHeight: 1.6 }}>
        {error ? `⚠️ No se pudieron leer los planes: ${error}` : (
          <>Sin planes en el tablero todavía.<br />
          Abrí Asun con IrmaMax, activá <strong style={{ color: ACCENT }}>PROYECTO</strong> y contale tu idea.</>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Selector de plan (cuando hay más de uno) */}
      {plans.length > 1 && (
        <select
          value={selectedId ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#131215', border: `1px solid ${ACCENT}55`, borderRadius: 8,
            padding: '7px 10px', color: '#D4D8DC', fontSize: '0.8rem',
            fontFamily: "'Space Grotesk', sans-serif", outline: 'none',
          }}
        >
          {plans.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      )}

      {plan && (
        <>
          {/* Cabecera del plan + avance */}
          <div style={{
            border: `1px solid ${ACCENT}33`, borderRadius: 10, background: '#131215',
            padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: '0.9rem', fontWeight: 700,
                color: ACCENT, flex: 1, lineHeight: 1.35,
              }}>{plan.title}</span>
              <button
                onClick={handleDelete}
                title="Borrar plan del tablero"
                style={{ background: 'transparent', border: '1px solid #CF444D55', borderRadius: 5, padding: '2px 7px', color: '#CF444D', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}
              >🗑</button>
            </div>
            {plan.description && (
              <span style={{ fontSize: '0.72rem', color: '#9BA3A8', lineHeight: 1.5 }}>{plan.description}</span>
            )}

            {/* Barra de progreso */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${progress.percent}%`, height: '100%', background: ACCENT, transition: 'width 0.2s' }} />
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: '#9BA3A8', whiteSpace: 'nowrap' }}>
                {progress.done}/{progress.total} · {progress.percent}%
              </span>
            </div>

            {/* CTA principal: bloque en curso / siguiente pendiente */}
            {current ? (
              <button
                onClick={() => send(current.id)}
                style={{
                  marginTop: 2, padding: '8px 12px', borderRadius: 8,
                  background: `${ACCENT}1A`, border: `1px solid ${ACCENT}`,
                  color: ACCENT, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.03em',
                  textAlign: 'left',
                }}
              >▶ Ejecutar bloque {current.id}: {current.title}</button>
            ) : (
              <span style={{ fontSize: '0.7rem', color: '#7FD1A8', fontWeight: 700 }}>✓ Plan completo</span>
            )}

            {/* E3: leer/preguntar desde Cochi (tablero completo, no un bloque) */}
            <button
              onClick={sendBoard}
              style={{
                alignSelf: 'flex-start', background: 'transparent',
                border: `1px solid ${ACCENT}55`, borderRadius: 5, padding: '3px 9px',
                color: ACCENT, fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >→ Enviar la Planificación a Cochi</button>
          </div>

          {/* Bloques */}
          {plan.blocks.map(block => {
            const isCurrent = current?.id === block.id
            const accent = STATUS_ACCENT[block.status] || '#8A868B'
            return (
              <div key={block.id} style={{
                border: `1px solid ${isCurrent ? `${ACCENT}66` : 'rgba(255,255,255,0.07)'}`,
                borderLeft: `3px solid ${accent}`,
                borderRadius: 8, background: '#131215', padding: '9px 10px',
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.66rem', fontWeight: 700,
                    color: '#0F0E11', background: accent, borderRadius: 4,
                    padding: '1px 6px', minWidth: 18, textAlign: 'center',
                  }}>{block.id}</span>
                  <span style={{ flex: 1, fontSize: '0.82rem', color: '#D4D8DC', lineHeight: 1.35 }}>{block.title}</span>
                </div>

                {block.description && (
                  <span style={{ fontSize: '0.72rem', color: '#9BA3A8', lineHeight: 1.5 }}>{block.description}</span>
                )}
                {block.evidence && (
                  <span style={{ fontSize: '0.68rem', color: '#7A8FA0', lineHeight: 1.5 }}>
                    ✓ Hecho cuando: {block.evidence}
                  </span>
                )}
                {block.evidenceLog?.length > 0 && (
                  <span style={{ fontSize: '0.66rem', color: '#7FD1A8', lineHeight: 1.5 }}>
                    ↳ Evidencia ({block.evidenceLog[block.evidenceLog.length - 1].by}): {block.evidenceLog[block.evidenceLog.length - 1].text}
                  </span>
                )}

                {/* Bloque E4: propuesta de re-plan de Cochi (pendiente de decisión) */}
                {hasPendingReplan(block) && (
                  <div style={{
                    border: '1px solid #E0575F66', borderLeft: '3px solid #E0575F',
                    borderRadius: 6, background: '#E0575F12', padding: '7px 8px',
                    display: 'flex', flexDirection: 'column', gap: 5,
                  }}>
                    <span style={{ fontSize: '0.68rem', color: '#E0575F', fontWeight: 700 }}>
                      ⚠ Re-plan propuesto por {block.replan.requestedBy}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#C9A9AC', lineHeight: 1.5 }}>
                      Problema: {block.replan.reason}
                    </span>
                    {block.replan.proposal && (
                      <span style={{ fontSize: '0.68rem', color: '#9BA3A8', lineHeight: 1.5 }}>
                        Propuesta: {block.replan.proposal}
                      </span>
                    )}
                    <div style={{ display: 'flex', gap: 5, marginTop: 1 }}>
                      <button
                        disabled={busy}
                        onClick={() => resolve(block.id, 'approved')}
                        style={{
                          flex: 1, padding: '4px 7px', borderRadius: 6,
                          border: '1px solid #7FD1A8', background: '#7FD1A81A',
                          color: '#7FD1A8', fontSize: '0.62rem', fontWeight: 700,
                          cursor: busy ? 'default' : 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >✓ Aprobar desviación</button>
                      <button
                        disabled={busy}
                        onClick={() => askAsun(block.id)}
                        style={{
                          flex: 1, padding: '4px 7px', borderRadius: 6,
                          border: '1px solid #C8A2D8', background: '#C8A2D81A',
                          color: '#C8A2D8', fontSize: '0.62rem', fontWeight: 700,
                          cursor: busy ? 'default' : 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >→ Que Asun amende</button>
                    </div>
                  </div>
                )}

                {/* Control de estado (manual en E2; Cochi lo hará en E3) */}
                <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                  {STATUS_ORDER.map(st => {
                    const active = block.status === st
                    return (
                      <button
                        key={st}
                        disabled={busy}
                        onClick={() => !active && changeStatus(block.id, st)}
                        style={{
                          flex: 1, padding: '4px 6px', borderRadius: 6,
                          border: `1px solid ${active ? STATUS_ACCENT[st] : 'rgba(255,255,255,0.08)'}`,
                          background: active ? `${STATUS_ACCENT[st]}1A` : 'transparent',
                          color: active ? STATUS_ACCENT[st] : '#6B7075',
                          fontSize: '0.62rem', fontWeight: 700, cursor: busy ? 'default' : 'pointer',
                          fontFamily: "'Space Grotesk', sans-serif",
                          opacity: busy ? 0.6 : 1,
                        }}
                      >{statusLabel(st)}</button>
                    )
                  })}
                </div>

                <button
                  onClick={() => send(block.id)}
                  style={{
                    marginTop: 2, alignSelf: 'flex-start',
                    background: 'transparent', border: `1px solid ${ACCENT}55`, borderRadius: 5,
                    padding: '3px 9px', color: ACCENT, fontSize: '0.62rem', fontWeight: 700,
                    cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >→ Enviar a Cochi</button>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
