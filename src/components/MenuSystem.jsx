import { useState } from 'react'
import { supabase } from '../supabaseClient'
import AppHeader from './AppHeader'
import Billing from '../pages/Billing'
import PreferencesModal from './PreferencesModal'
import Chat00 from './Chat00'

export default function MenuSystem({ onBack, user, initialVista = 'ia-publica', onLoginClick }) {
  const [vista, setVista] = useState(initialVista)
  const [showPreferences, setShowPreferences] = useState(false)

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