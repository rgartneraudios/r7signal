import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Billing() {
  const [balance, setBalance] = useState(null)
  const [turnos, setTurnos] = useState([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    let subscription

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      await cargarDatos(user.id)

      subscription = supabase
        .channel('billing-realtime')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'balances',
          filter: `user_id=eq.${user.id}`
        }, () => {
          cargarDatos(user.id)
        })
        .subscribe()
    }

    init()

    return () => {
      if (subscription) supabase.removeChannel(subscription)
    }
  }, [])

  async function cargarDatos(uid) {
    const { data: bal } = await supabase
      .from('balances')
      .select('credito, tokens_usados, ahorro_total, updated_at')
      .eq('user_id', uid)
      .single()

    const { data: turnosData } = await supabase
      .from('turnos')
      .select('coste, tokens_input, tokens_output, modelo_usado, created_at, sesiones!inner(user_id)')
      .eq('sesiones.user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)

    setBalance(bal)
    setTurnos(turnosData || [])
    setLoading(false)
  }

  if (loading) return <div className="billing-loading">Cargando créditos...</div>

  return (
    <div className="billing-container">
      <h1 className="billing-title">CRÉDITOS R7</h1>

      <div className="billing-saldo-card">
        <span className="billing-saldo-amount">
          $ {balance?.credito?.toFixed(4) ?? '0.0000'}
        </span>
        <span className="billing-saldo-label">saldo disponible</span>
      </div>

      <div className="billing-stats">
        <div className="billing-stat">
          <span className="billing-stat-value">$ {balance?.ahorro_total?.toFixed(4) ?? '0.0000'}</span>
          <span className="billing-stat-label">Ahorro R7</span>
        </div>
        <div className="billing-stat">
          <span className="billing-stat-value">{balance?.tokens_usados?.toLocaleString() ?? '0'}</span>
          <span className="billing-stat-label">Tokens usados</span>
        </div>
      </div>

      <h2 className="billing-section-title">ÚLTIMOS TURNOS</h2>

      <div className="billing-turnos">
        {turnos.length === 0 && (
          <p className="billing-empty">Aún no hay turnos registrados.</p>
        )}
        {turnos.map((t, i) => (
          <div key={i} className="billing-turno-row">
            <span className="billing-turno-fecha">
              {new Date(t.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="billing-turno-modelo">{t.modelo_usado ?? '—'}</span>
            <span className="billing-turno-tokens">{(t.tokens_input + t.tokens_output).toLocaleString()} tk</span>
            <span className="billing-turno-coste">-$ {t.coste?.toFixed(6) ?? '0.000000'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
