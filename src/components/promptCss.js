import { COLORS, rgba } from './toolPalette'

export const PROMPT_CSS = `
  .pia-shell::-webkit-scrollbar { width: 10px; }
  .pia-shell::-webkit-scrollbar-track { background: rgba(0,0,0,0.35); border-radius: 8px; }
  .pia-shell::-webkit-scrollbar-thumb { background: #2A2930; border-radius: 8px; border: 2px solid #0F0E11; }
  .pia-shell::-webkit-scrollbar-thumb:hover { background: #3A3942; }

  .pia-opt {
    position: relative;
    padding: 14px 16px; border-radius: 12px; cursor: pointer;
    background: linear-gradient(150deg, #24222A 0%, #17161B 55%, #0D0C10 100%);
    border: 1px solid rgba(212,216,220,0.18);
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif;
    font-size: 0.98rem; font-weight: 700; letter-spacing: 0.02em;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 18px rgba(0,0,0,0.6);
    transition: transform .12s ease, box-shadow .2s ease, border-color .2s ease, color .2s ease;
  }
  .pia-opt:hover {
    transform: translateY(-2px);
    border-color: ${rgba(COLORS.gold, 0.6)};
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 0 20px ${rgba(COLORS.gold, 0.22)}, 0 10px 22px rgba(0,0,0,0.7);
  }
  .pia-opt:active { transform: translateY(1px) scale(.98); }
  .pia-opt.on {
    border-color: ${COLORS.gold};
    color: ${COLORS.goldBright};
    box-shadow: inset 0 0 18px ${rgba(COLORS.gold, 0.18)}, 0 0 22px ${rgba(COLORS.gold, 0.28)};
  }

  .pia-style {
    padding: 0; overflow: hidden; border-radius: 14px; cursor: pointer;
    background: #131215; border: 1px solid rgba(212,216,220,0.16);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 14px 34px rgba(0,0,0,0.72);
    transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .25s ease, border-color .25s ease;
    display: flex; flex-direction: column;
  }
  .pia-style:hover {
    transform: translateY(-4px);
    border-color: ${rgba(COLORS.gold, 0.55)};
    box-shadow: 0 22px 46px rgba(0,0,0,0.85), 0 0 26px ${rgba(COLORS.gold, 0.18)};
  }
  .pia-style.on {
    border-color: ${COLORS.gold};
    box-shadow: 0 0 26px ${rgba(COLORS.gold, 0.35)}, inset 0 0 18px ${rgba(COLORS.gold, 0.12)};
  }

  .pia-btn {
    padding: 12px 22px; border-radius: 12px; cursor: pointer;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.72rem; font-weight: 800;
    letter-spacing: 0.18em; text-transform: uppercase;
    background: linear-gradient(135deg, ${rgba(COLORS.gold, 0.2)} 0%, ${rgba(COLORS.gold, 0.07)} 100%);
    border: 1px solid ${rgba(COLORS.gold, 0.45)};
    color: ${COLORS.goldBright};
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.6);
    transition: all .22s ease;
  }
  .pia-btn:hover {
    border-color: ${COLORS.gold};
    box-shadow: 0 0 22px ${rgba(COLORS.gold, 0.35)}, 0 10px 24px rgba(0,0,0,0.7);
  }
  .pia-btn:disabled { opacity: .4; cursor: not-allowed; box-shadow: none; }
  .pia-btn.ghost {
    background: linear-gradient(135deg, ${rgba(COLORS.silver, 0.10)} 0%, rgba(255,255,255,0.02) 100%);
    border-color: rgba(212,216,220,0.28);
    color: ${COLORS.silver};
  }
  .pia-btn.ghost:hover { border-color: ${rgba(COLORS.silver, 0.6)}; box-shadow: 0 0 18px rgba(212,216,220,0.18); }

  .pia-area {
    width: 100%; box-sizing: border-box; min-height: 120px;
    background: linear-gradient(180deg, #0B0A0D 0%, #131216 100%);
    border: 1px solid rgba(212,216,220,0.22); border-radius: 12px;
    color: #E8E6EC; font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem; font-weight: 500; line-height: 1.6;
    padding: 14px; outline: none; resize: vertical;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75);
    transition: border-color .2s ease, box-shadow .2s ease;
  }
  .pia-area::placeholder { color: #5A585C; font-weight: 400; }
  .pia-area:focus {
    border-color: ${COLORS.fieldEdge};
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 20px ${rgba(COLORS.fieldEdge, 0.45)};
  }

  .pia-prompt {
    margin: 0; white-space: pre-wrap; word-break: break-word;
    background: linear-gradient(180deg, #14110A 0%, #100E0C 100%);
    border: 1px solid ${COLORS.fieldEdge}; border-radius: 12px;
    color: ${COLORS.goldBright}; font-family: 'Space Grotesk', ui-monospace, monospace;
    font-size: 0.95rem; line-height: 1.7; padding: 18px;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.75), 0 0 22px ${rgba(COLORS.fieldEdge, 0.25)};
  }
`
