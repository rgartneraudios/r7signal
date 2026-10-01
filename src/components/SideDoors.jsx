// ─── Puertas laterales con gatillos (01/10) ──────────────────────────────────
// Despejan el header: la puerta DERECHA (gatillo con ▶) abre el modal R9
// compartido (Sesiones/Planes/R9). La puerta IZQUIERDA (gatillo con ◀) desliza un
// panel con accesos: Memories, Base de datos (carpeta AppLocalData), y los
// atajos de OpenRouter (Credits/Activity).
import { useState } from 'react'
import { Command, open as openShell } from '@tauri-apps/plugin-shell'
import { openPath, openUrl } from '@tauri-apps/plugin-opener'
import { appLocalDataDir } from '@tauri-apps/api/path'

const PINK = '#FA61DB'
const BORDEAU = '#7B2D3B'
const GREEN = '#B2FF61'
const CYAN = '#5FD3E0'

function doorBtn(color) {
  return {
    background: `${color}14`,
    border: `1px solid ${color}66`,
    color,
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: '0.74rem',
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: '0.04em',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  }
}

async function openDataFolder() {
  try {
    const dir = await appLocalDataDir()
    const esc = dir.replace(/"/g, '""')
    // PowerShell Start-Process es el método más fiable en Windows (mismo permiso
    // `shell:allow-execute` que usa run_command). Si falla, se cae al opener.
    try {
      await Command.create('powershell', ['-Command', `Start-Process -FilePath "${esc}"`]).execute()
      return
    } catch (err) {
      console.error('powershell Start-Process falló:', err)
    }
    try {
      await openShell(dir)
    } catch (err) {
      console.error('shell open falló, probando opener:', err)
      await openPath(dir)
    }
  } catch (err) {
    console.error('No se pudo abrir la carpeta de datos:', err)
  }
}

export default function SideDoors({ onOpenMemories, onOpenR9 }) {
  const [leftOpen, setLeftOpen] = useState(false)

  return (
    <>
      {/* ── Gatillo puerta IZQUIERDA ── */}
      <button
        onClick={() => setLeftOpen(o => !o)}
        title={leftOpen ? 'Cerrar accesos' : 'Memories y accesos'}
        className={`fixed top-1/2 -translate-y-1/2 z-[100] h-16 w-3 bg-black/50 backdrop-blur-md border border-white/15 rounded-r-lg flex items-center justify-center transition-all ${leftOpen ? 'left-64' : 'left-0'}`}
      >
        <span className="flex items-center gap-[2px]">
          <span className="block w-[2px] h-7 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px 1px #22D3EE, 0 0 12px #22D3EE88' }} />
          <span className="block w-[2px] h-7 rounded-full bg-cyan-400" style={{ boxShadow: '0 0 6px 1px #22D3EE, 0 0 12px #22D3EE88' }} />
        </span>
      </button>

      {/* ── Panel puerta IZQUIERDA ── */}
      <div
        className={`fixed top-0 left-0 h-full w-64 z-[99] bg-[#0F0E11] border-r border-white/10 flex flex-col transition-transform duration-200 ${leftOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ boxShadow: leftOpen ? '12px 0 40px rgba(0,0,0,0.5)' : 'none' }}
      >
        <div className="px-4 pt-4 pb-3 border-b border-white/10">
          <div className="font-[Orbitron] text-[0.7rem] tracking-[0.18em] font-bold" style={{ color: CYAN }}>
            ACCESOS
          </div>
        </div>
        <div className="p-3 flex flex-col gap-2">
          <button style={doorBtn(PINK)} onClick={() => { setLeftOpen(false); onOpenMemories?.() }}>
            🕯️ Memories
          </button>
          <button style={doorBtn(BORDEAU)} onClick={openDataFolder} title="Abrir la carpeta de datos en el Explorador">
            🗄️ Base de datos
          </button>
          <div className="h-px bg-white/10 my-1" />
          <button
            style={doorBtn(GREEN)}
            onClick={() => openUrl('https://openrouter.ai/settings/credits').catch(() => window.open('https://openrouter.ai/settings/credits', '_blank'))}
          >
            OR Credits
          </button>
          <button
            style={doorBtn(GREEN)}
            onClick={() => openUrl('https://openrouter.ai/activity').catch(() => window.open('https://openrouter.ai/activity', '_blank'))}
          >
            OR Activity
          </button>
        </div>
      </div>

      {/* ── Gatillo puerta DERECHA (abre R9 compartido) ── */}
      <button
        onClick={() => onOpenR9?.()}
        title="R9 — Memoria compartida (Sesiones · Planes · R9)"
        className="fixed top-1/2 -translate-y-1/2 right-0 z-[100] h-16 w-3 bg-black/50 backdrop-blur-md border border-white/15 rounded-l-lg flex items-center justify-center transition-all"
      >
        <span className="flex items-center gap-[2px]">
          <span className="block w-[2px] h-7 rounded-full bg-fuchsia-400" style={{ boxShadow: '0 0 6px 1px #E879F9, 0 0 12px #E879F988' }} />
          <span className="block w-[2px] h-7 rounded-full bg-fuchsia-400" style={{ boxShadow: '0 0 6px 1px #E879F9, 0 0 12px #E879F988' }} />
        </span>
      </button>
    </>
  )
}
