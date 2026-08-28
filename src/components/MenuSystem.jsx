import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../context/AuthContext'
import AppHeader from './AppHeader'
import Billing from '../pages/Billing'
import PreferencesModal from './PreferencesModal'
import Chat00 from './Chat00'

export default function MenuSystem({ onBack, user, initialVista = 'ia-publica', onLoginClick }) {
  const { setUser } = useAuth()
  const [vista, setVista] = useState(initialVista)
  const [showPreferences, setShowPreferences] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
    onBack()
  }

  if (vista === 'billing') {
    return (
      <>
        <AppHeader onLoginClick={onLoginClick} onVolver={() => setVista('ia-publica')} />
        <Billing />
        {showPreferences && (
          <PreferencesModal
            onClose={() => setShowPreferences(false)}
            userId={user?.id}
            supabase={supabase}
          />
        )}
      </>
    )
  }

  return (
    <>
      <AppHeader onLoginClick={onLoginClick} onVolver={onBack} />
      <Chat00 />
      {showPreferences && (
        <PreferencesModal
          onClose={() => setShowPreferences(false)}
          userId={user?.id}
          supabase={supabase}
        />
      )}
    </>
  )
}