// ─── Sesiones + rueda R7 + undo (KD/X1/X2/L4) ─────────────────────────────────
// Denominador común de Cochi/Asun/Tito. Encapsula:
//   · la rueda R7 { r7, lastTurn } y las parejas R1/R2 del turno en curso
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
import { makeSession, saveSession, loadSession, undoLastTurn, suggestSessionName } from '../lib/sessionStore.js'
import { createWheelState, flushWheel } from '../lib/r7Wheel.js'
import { writeR9File, readLatestR7 } from '../lib/r9Store.js'

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
  onAfterArchive,
  onResetUsage,
  onError,
}) {
  const wheelRef = useRef(createWheelState()) // { r7, lastTurn }
  const sessionPairsRef = useRef([])           // pares R1/R2 emitidos en el turno
  const messagesRef = useRef([])              // espejo de `messages` para autosave
  const skipAutosaveRef = useRef(true)        // true en montaje y al retomar
  const sessionIdRef = useRef(null)           // id estable por conversación
  const sessionNameRef = useRef(null)         // nombre del artefacto R7

  // Espejo de `messages` (setState es async; el autosave necesita el estado final).
  useEffect(() => { messagesRef.current = messages }, [messages])

  // Al abrir, adoptar la rueda R7 global desde disco.
  useEffect(() => {
    readLatestR7().then(r7 => { wheelRef.current = createWheelState(r7) })
  }, [])

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
        sessionPairsRef.current = []
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
  }

  // Al archivar/CLS, la rueda actual se promueve a global como chat_N nuevo para
  // que la sesión siguiente herede la continuidad (K2 decisión 3).
  async function promoteWheelToGlobal() {
    const sealed = flushWheel(wheelRef.current)
    if (sealed.r7 && sealed.r7.trim()) await writeR9File('r7', sealed.r7)
  }

  // Cierra la sesión actual: captura su id (para la limpieza del panel), resetea
  // rueda/parejas/id y, opcionalmente, hereda el nombre a la próxima.
  async function closeCurrentSession({ inheritName = null } = {}) {
    const closingSessionId = sessionIdRef.current
    sessionPairsRef.current = []
    wheelRef.current = createWheelState(await readLatestR7())
    sessionIdRef.current = null
    sessionNameRef.current = inheritName
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
      await promoteWheelToGlobal()
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

  // CLS: archiva la sesión y arranca una conversación nueva con la rueda global.
  // El confirm() y el reset del panel los aporta quien llama.
  async function clearSession() {
    persistCurrentSession()
    await promoteWheelToGlobal()
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
    sessionPairsRef,
    messagesRef,
    skipAutosaveRef,
    sessionIdRef,
    sessionNameRef,
    persistCurrentSession,
    promoteWheelToGlobal,
    archive,
    archiveWithName,
    clearSession,
    undoTurn,
  }
}
