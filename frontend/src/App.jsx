import React, { useState, useEffect } from 'react'
import { ChatTIWidget } from './ChatTIWidget'
import './styles.css'
import { 
  Patients, Consultations, Appointments, Documents, Reports, Locations, 
  Devices, Dashboard, Users, Profile, DeviceManagementDashboard, 
  dashboard2 
} from './hospitalModules'
import { useAuth, AuthProvider } from './AuthContext'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL"
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY"
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

const ROUTES_MAP = {
  '/dashboard': Dashboard,
  '/patients': Patients,
  '/consultations': Consultations,
  '/appointments': Appointments,
  '/documents': Documents,
  '/locations': Locations,
  '/devices': Devices,
  '/device-management': DeviceManagementDashboard,
  '/users': Users,
  '/reports': Reports,
  '/profile': Profile,
  '/dashboard2': dashboard2,
}

const normalizeRoute = (hash) => {
  const route = String(hash || '').replace(/^#/, '')
  if (!route || route === '/' || route === '/home') return '/dashboard'
  return route
}

function AppHeader({ onOpenChat, unreadChatCount }) {
  const { user } = useAuth()

  return (
    <header className="app-header">
      <div style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: '#4f46e5' }}>•</span> Tablero Ejecutivo
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={onOpenChat}
            className="button secondary"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
          >
            <MessageSquare size={16} />
            <span>Chat TI</span>
            {unreadChatCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#ef4444', color: '#fff', fontSize: '10px',
                fontWeight: 'bold', width: '18px', height: '18px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {unreadChatCount}
              </span>
            )}
          </button>
          <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>{user.username || user.email}</span>
        </div>
      )}
    </header>
  )
}

function MainLayout() {
  const { user } = useAuth()
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash))
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  useEffect(() => {
    const handleHashChange = () => setRoute(normalizeRoute(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Selección estricta del componente de ruta para evitar doble renderizado
  const ActiveViewComponent = ROUTES_MAP[route] || Dashboard

  return (
    <div className="app-layout">
      <main className="main-content">
        <AppHeader 
          onOpenChat={() => { setIsChatOpen(true); setUnreadChatCount(0); }} 
          unreadChatCount={unreadChatCount} 
        />
        
        {/* Contenedor aislado con BFC independiente */}
        <div className="view-container">
          <ActiveViewComponent />
        </div>

        <ChatTIWidget 
          currentUser={user}
          supabase={supabase}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  )
}