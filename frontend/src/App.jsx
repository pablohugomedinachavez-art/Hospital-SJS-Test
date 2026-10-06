import React, { useState, useEffect } from 'react'
import { ChatTIWidget } from './ChatTIWidget'
import './styles.css'
import { 
  Patients, Consultations, Appointments, Documents, Reports, Locations, 
  Devices, Dashboard, Users, Profile, DeviceManagementDashboard, 
  dashboard2 
} from './hospitalModules'
import { useAuth, AuthProvider } from './AuthContext'
import { Login } from './Login'
import { MessageSquare } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error capturado por ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', margin: '2rem auto', maxWidth: '500px' }}>
          <h2 style={{ color: '#ef4444', fontSize: '1.25rem', marginBottom: '0.5rem' }}>Error al cargar este módulo</h2>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {this.state.error?.message || "Ocurrió una excepción inesperada."}
          </p>
          <button onClick={() => window.location.reload()} className="button primary">
            Recargar Página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const { user } = useAuth();

  return (
    <header className="app-header">
      <div style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: '#3b82f6' }}>•</span> Panel Hospitalario
      </div>

      {user && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={onOpenChat}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#1f2937',
              border: '1px solid #374151',
              color: '#f3f4f6',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              position: 'relative',
              fontSize: '0.85rem'
            }}
          >
            <MessageSquare size={16} className="text-cyan-400" />
            <span>Chat TI</span>
            {unreadChatCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                background: '#ef4444',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadChatCount}
              </span>
            )}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#3b82f6',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}>
              {(user.username || user.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>{user.username || user.email}</span>
          </div>
        </div>
      )}
    </header>
  );
}

function AppContent() {
  const { user } = useAuth();
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash));
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  useEffect(() => {
    const handleHashChange = () => setRoute(normalizeRoute(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderRoute = () => {
    const Component = ROUTES_MAP[route] || ROUTES_MAP['/dashboard'];
    return <Component />;
  };

  return (
    <div className="app-layout">
      {/* Contenido principal delimitado por flujo bloque */}
      <main className="main-content">
        <AppHeader 
          onOpenChat={() => { setIsChatOpen(true); setUnreadChatCount(0); }} 
          unreadChatCount={unreadChatCount} 
        />
        
        <div className="view-container" style={{ width: '100%', position: 'relative' }}>
          <ErrorBoundary>
            {renderRoute()}
          </ErrorBoundary>
        </div>

        <ChatTIWidget 
          currentUser={user}
          supabase={supabase}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
        />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}