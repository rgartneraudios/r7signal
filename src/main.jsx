import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext'

// Bloque R (performance): StrictMode duplica renders/efectos SÓLO en dev y con
// componentes de 600–1900 líneas eso es ~2x el costo de cada actualización. Por
// defecto queda APAGADO en dev para que `tauri dev` refleje mejor el rendimiento
// real; se puede reactivar con VITE_STRICT=true (útil como red de bugs).
// En producción nunca se monta, así que esto no cambia el build.
const tree = (
  <AuthProvider>
    <App />
  </AuthProvider>
)

createRoot(document.getElementById('root')).render(
  import.meta.env.VITE_STRICT === 'true' ? <StrictMode>{tree}</StrictMode> : tree
)