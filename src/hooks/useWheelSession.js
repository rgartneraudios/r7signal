// ─── Sesiones + rueda R7 + undo (KD/X1/X2/L4) ─────────────────────────────────
// Denominador común de Cochi/Asun/Tito. Encapsula:
//   · la rueda R7 { r7, lastTurn } (el sistema sella R1/R2 con commitR7Turn)
//   · el ciclo de vida de la sesión (id, nombre, autosave por turno, retoma
//     "cargar como contexto", archivar/CLS con promoción de la rueda a global)
//   · undo (deshace el último turno visible y retrocede la rueda)
//
// Lo específico de cada panel se inyecta por opciones:
//   · busy          → booleano; bloquea autosave y archivado mientras hay trabajo
//   · onReset()     → reset del estado propio del panel (mensajes, tokens, plan…)
//                     se usa al archivar y al hacer CLS
//   · onResume()    → reset extra al retomar una sesión guardada (si difiere)
//   · onAfterArchive(closingSessionId) → limpieza propia (p.ej. snapshots Cochi)
//   · onError(msg)  → pintar el fallo de archivado con el shape del panel
import { useEffect, useRef } from 'react'
import { makeSession, saveSession, loadSession, saveActiveSession, loadActiveSession, clearActiveSession, undoLastTurn, suggestSessionName } from '../lib/sessionStore.js'
import { createWheelState, flushWheel, compactWheel } from '../lib/r7Wheel.js'
import { writeR9File } from '../lib/r9Store.js'

// Acepta el shape canónico (role/content) y el interno de Asun (rol/contenido).
export function isUserMsg(m) {
  return m?.role === 'user' || m?.rol === 'usuario'
}

export function useWheelSession({
  agent,
  messages,
  busy = false,
  pendingSession,
  onSessionConsumed,
  onReset,
  onResume,
  onRestore,
  onAfterArchive,
  onResetUsage,
  onError,
}) {
  const wheelRef = useRef(createWheelState()) // { r7, lastTurn }
  const messagesRef = useRef([])              // espejo de `messages` para autosave
  const skipAutosaveRef = useRef(true)        // true en montaje y al retomar
  const sessionIdRef = useRef(null)           // id estable por conversación
  const sessionNameRef = useRef(null)         // nombre del artefacto R7

  // Espejo de `messages` (setState es async; el autosave necesita el estado final).
  useEffect(() => { messagesRef.current = messages }, [messages])

  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  // Arranque: sesión FRÍA (sin rueda). Si existe un puntero a la sesión ACTIVA
  // (reload de HMR/Ctrl+R o reapertura) se retoma esa conversación —mensajes +
  // rueda— para no caer al watermark. Las demás sesiones se incorporan SÓLO
  // desde la pestaña Sesiones (R9 compartida).
  useEffect(() => {
    let alive = true
    wheelRef.current = createWheelState('')
    ;(async () => {
      try {
        const activeId = await loadActiveSession(agent)
        if (!alive || !activeId) return
        if (sessionIdRef.current || messagesRef.current.some(isUserMsg)) return
        const s = await loadSession(activeId)
        if (!alive || !s || (s.agent && s.agent !== agent)) return
        skipAutosaveRef.current = true
        wheelRef.current = { r7: s.wheel?.r7 || '', lastTurn: s.wheel?.lastTurn ?? null }
        sessionIdRef.current = s.id
        sessionNameRef.current = s.name || null
        if (Array.isArray(s.messages) && s.messages.length) onRestoreRef.current?.(s.messages)
      } catch (err) {
        console.error(`restore ${agent}:`, err)
      }
    })()
    return () => { alive = false }
  }, [agent])

  // Autosave tras cerrar cada turno (KD5). Salta montaje/retomas y nunca guarda
  // mientras hay trabajo en curso.
  useEffect(() => {
    if (skipAutosaveRef.current) { skipAutosaveRef.current = false; return }
    if (busy) return
    if (!messages.some(isUserMsg)) return
    const session = makeSession(agent, {
      sessionId: sessionIdRef.current,
      name: sessionNameRef.current,
      wheel: wheelRef.current,
      messages,
    })
    sessionIdRef.current = session.id
    saveSession(session).catch(err => console.error(`autosave ${agent}:`, err))
    saveActiveSession(agent, session.id).catch(err => console.error(`active ${agent}:`, err))
  }, [messages, busy, agent])

  // "Cargar como contexto": NO restaura la conversación; arranca en cero y
  // adopta la rueda de la sesión. Id NUEVO (el artefacto original es semilla).
  // `onSessionConsumed` se llama DESPUÉS del await (fix K2).
  useEffect(() => {
    if (!pendingSession) return
    const { id } = pendingSession
    let alive = true
    ;(async () => {
      const s = await loadSession(id)
      if (!alive) return
      if (s) {
        skipAutosaveRef.current = true
        wheelRef.current = { r7: s.wheel?.r7 || '', lastTurn: s.wheel?.lastTurn ?? null }
        sessionIdRef.current = null
        sessionNameRef.current = s.name || null
        ;(onResume || onReset)?.()
        onResetUsage?.(agent)
      }
      onSessionConsumed?.()
    })()
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSession?.nonce])

  // Sella el estado actual como sesión (overwrite Sessions/<id>.json).
  function persistCurrentSession() {
    const msgs = messagesRef.current
    if (!msgs.some(isUserMsg)) return
    const session = makeSession(agent, {
      sessionId: sessionIdRef.current,
      name: sessionNameRef.current,
      wheel: wheelRef.current,
      messages: msgs,
    })
    sessionIdRef.current = session.id
    saveSession(session).catch(err => console.error(`autosave ${agent}:`, err))
    saveActiveSession(agent, session.id).catch(err => console.error(`active ${agent}:`, err))
  }

  // Al archivar/CLS, la rueda actual se promueve como chat_N nuevo DEL AGENTE
  // (R7/<agente>/) para que la sesión siguiente herede la continuidad (K2
  // decisión 3). `bodyOverride` permite sembrar una versión compactada en vez del
  // cuerpo completo.
  async function promoteWheelToAgent(bodyOverride = null) {
    const sealed = flushWheel(wheelRef.current)
    const body = bodyOverride ?? sealed.r7
    if (body && body.trim()) await writeR9File('r7', body, {}, { agent })
  }

  // Cierra la sesión actual: captura su id (para la limpieza del panel), resetea
  // rueda/id, limpia el puntero de sesión activa (arranque frío) y, opcionalmente,
  // hereda el nombre a la próxima.
  async function closeCurrentSession({ inheritName = null } = {}) {
    const closingSessionId = sessionIdRef.current
    wheelRef.current = createWheelState('')
    sessionIdRef.current = null
    sessionNameRef.current = inheritName
    await clearActiveSession(agent).catch(() => {})
    await onAfterArchive?.(closingSessionId)
  }

  // Archiva la sesión actual (sobreescribe) y arranca una nueva. `nameOverride`
  // define el nombre; sin él se conserva el actual.
  async function archive(nameOverride) {
    if (busy) return
    if (!messagesRef.current.some(isUserMsg)) return
    const inheritedName = typeof nameOverride === 'string' && nameOverride
      ? nameOverride
      : sessionNameRef.current
    try {
      if (inheritedName) sessionNameRef.current = inheritedName
      persistCurrentSession()
      await promoteWheelToAgent()
      onReset?.()
      await closeCurrentSession({ inheritName: inheritedName || null })
      onResetUsage?.(agent)
    } catch (err) {
      onError?.(`⚠️ No se pudo archivar la sesión R7: ${err.message}`)
    }
  }

  // X2: archiva con un nombre elegido por el usuario; la próxima lo hereda.
  async function archiveWithName() {
    if (busy) return
    if (!messagesRef.current.some(isUserMsg)) return
    const suggested = sessionNameRef.current || suggestSessionName(messagesRef.current)
    const input = window.prompt('Nombre de la sesión (artefacto R7). La próxima sesión heredará el nombre:', suggested)
    if (input === null) return
    const name = input.trim() || suggested
    sessionNameRef.current = name
    await archive(name)
  }

  // Compactación del sistema (botón 70k): NO llama al modelo. Persiste el
  // histórico COMPLETO (sesión + artefacto R7) y siembra una versión compactada
  // como rueda global para que la sesión nueva arranque liviana sin perder nada.
  async function compact() {
    if (busy) return
    if (!messagesRef.current.some(isUserMsg)) return
    const closingSessionId = sessionIdRef.current
    const inheritedName = sessionNameRef.current
    try {
      const sealed = flushWheel(wheelRef.current)
      wheelRef.current = sealed
      persistCurrentSession()
      if (sealed.r7 && sealed.r7.trim()) await writeR9File('r7', sealed.r7, {}, { agent })
      const compacted = compactWheel(sealed.r7)
      if (compacted && compacted.trim()) await writeR9File('r7', compacted, {}, { agent })
      onReset?.()
      wheelRef.current = createWheelState(compacted)
      sessionIdRef.current = null
      sessionNameRef.current = inheritedName
      await clearActiveSession(agent).catch(() => {})
      await onAfterArchive?.(closingSessionId)
      onResetUsage?.(agent)
    } catch (err) {
      onError?.(`⚠️ No se pudo compactar la sesión: ${err.message}`)
    }
  }

  // CLS: archiva la sesión y arranca una conversación nueva con la rueda global.
  // El confirm() y el reset del panel los aporta quien llama.
  async function clearSession() {
    persistCurrentSession()
    await promoteWheelToAgent()
    onReset?.()
    await closeCurrentSession({ inheritName: null })
    onResetUsage?.(agent)
  }

  // Undo (K3): pura, no toca disco. Devuelve los mensajes nuevos y el usuario
  // eliminado (para regenerate); el panel sincroniza messagesRef y su UI.
  function undoTurn() {
    const { messages: newMsgs, wheel: newWheel, undoneUser } = undoLastTurn(messagesRef.current, wheelRef.current)
    messagesRef.current = newMsgs
    wheelRef.current = newWheel
    return { messages: newMsgs, undoneUser }
  }

  return {
    wheelRef,
    messagesRef,
    skipAutosaveRef,
    sessionIdRef,
    sessionNameRef,
    persistCurrentSession,
    promoteWheelToAgent,
    archive,
    archiveWithName,
    compact,
    clearSession,
    undoTurn,
  }
}
