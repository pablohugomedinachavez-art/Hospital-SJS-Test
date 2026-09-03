import React, { useState, useEffect } from 'react'
import './styles.css'
import { Patients, Consultations, Appointments, Documents, Reports, Locations, Devices, Dashboard, Users, Profile, DeviceManagementDashboard } from './hospitalModules'
import { apiFetch } from './api'
import { useAuth, AuthProvider } from './AuthContext'
import { Login } from './Login'

const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  Clinical: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  Operations: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Reports: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Account: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}

const normalizeRoute = (hash) => {
  const route = String(hash || '').replace(/^#/, '')
  if (!route || route === '/' || route === '/home') return '/login'
  return route
}

function Sidebar({ currentRoute }) {
  const { user, logout } = useAuth()
  const [openSections, setOpenSections] = useState({
    dashboard: true, clinical: true, operations: true, users: true, reports: true, account: true
  })

  const hasPermission = (permission) => {
    const permissions = user?.permissions || user?.user_metadata?.permissions || []
    return Boolean(permissions.includes(permission))
  }

  const navGroups = [
    { key: 'dashboard', title: 'Panel', icon: <Icons.Dashboard />, items: [{ label: 'Dashboard', path: '/dashboard' }] },
    {
      key: 'clinical', title: 'Gestión clínica', icon: <Icons.Clinical />,
      items: [
        { label: 'Pacientes', path: '/patients' },
        { label: 'Consultas', path: '/consultations' },
        { label: 'Citas', path: '/appointments' },
        { label: 'Documentos', path: '/documents' }
      ]
    },
    {
      key: 'operations', 
      title: 'Gestión operativa', 
      icon: <Icons.Operations />,
      items: [
        { label: 'Ubicaciones', path: '/locations' },
        { label: 'Dispositivos', path: '/devices' },
        { label: 'Alertas', path: '/alerts' },
        { label: 'Auditoría & IP', path: '/device-management' }
      ]
    },
    { key: 'users', title: 'Usuarios', icon: <Icons.Users />, items: [{ label: 'Usuarios', path: '/users', permission: 'manage_users' }] },
    { key: 'reports', title: 'Informes', icon: <Icons.Reports />, items: [{ label: 'Reportes', path: '/reports' }] },
    { key: 'account', title: 'Cuenta', icon: <Icons.Account />, items: [{ label: 'Perfil', path: '/profile' }] }
  ]

  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <div className="sidebar-brand">Hospital TIC</div>
          <p className="sidebar-subtitle">Panel de Control</p>
        </div>
      </div>

      <div className="sidebar-welcome">
        <span>Hola, </span>
        <strong style={{ color: 'var(--text-main)' }}>{user?.username || user?.email || 'Invitado'}</strong>
      </div>

      <nav className="sidebar-nav">
        {navGroups.map(group => {
          const items = group.items.filter(item => !item.permission || hasPermission(item.permission))
          if (!items.length) return null
          return (
            <div key={group.key} className="sidebar-section">
              <button type="button" className="sidebar-section-header" onClick={() => toggleSection(group.key)}>
                <span className="sidebar-section-icon">{group.icon}</span>
                <span>{group.title}</span>
                <span className={`sidebar-chevron ${openSections[group.key] ? 'open' : ''}`}>▾</span>
              </button>
              {openSections[group.key] && (
                <div className="sidebar-section-items">
                  {items.map(item => (
                    <a key={item.path} href={`#${item.path}`} className={`sidebar-item ${currentRoute === item.path ? 'active' : ''}`}>
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <button type="button" className="sidebar-logout" onClick={logout}>Cerrar sesión</button>
        ) : (
          <a href="#/login" className="button secondary sidebar-logout" style={{ textAlign: 'center' }}>Login</a>
        )}
      </div>
    </aside>
  )
}


function CollectionList({ title, items = [], render, filters = [] }) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(filters.length ? filters[0].value : 'all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => { setCurrentPage(1) }, [query, activeFilter, items])

  const normalizedQuery = query.toLowerCase().trim()
  const filteredItems = items.filter(item => {
    const searchMatch = !normalizedQuery || JSON.stringify(item).toLowerCase().includes(normalizedQuery)
    const filter = filters.find(f => f.value === activeFilter)
    const filterMatch = !filter || activeFilter === 'all' || filter.predicate(item)
    return searchMatch && filterMatch
  })

  const pageSize = 12
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="card collection-card">
      <div className="collection-header">
        <h2>{title}</h2>
        <span className="collection-count">{filteredItems.length} elementos</span>
      </div>
      <div className="collection-toolbar">
        <div className="collection-search">
          <span>Búsqueda</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Filtrar registros..." />
        </div>
        {filters.length > 0 && (
          <div className="collection-filter">
            <span>Filtro</span>
            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
              {filters.map(filter => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>No hay registros.</p>
      ) : filteredItems.length === 0 ? (
        <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>No hay resultados para la búsqueda.</p>
      ) : (
        <>
          <div className="items-grid">
            {pageItems.map(item => render(item))}
          </div>
          {totalPages > 1 && (
            <div className="pagination-footer">
              <button type="button" className="button secondary" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button>
              <span>Página {currentPage} de {totalPages}</span>
              <button type="button" className="button secondary" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Alerts() {
  const [alerts, setAlerts] = useState([])
  const [devices, setDevices] = useState([])
  const [deviceId, setDeviceId] = useState('')
  const [alertType, setAlertType] = useState('device_offline')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [info, setInfo] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function load() {
    try {
      const [alertsRes, devicesRes] = await Promise.all([apiFetch('/alerts'), apiFetch('/devices')])
      if (alertsRes.ok) setAlerts(await alertsRes.json())
      if (devicesRes.ok) setDevices(await devicesRes.json())
    } catch (err) {
      setInfo('Error al conectar con el servidor')
    }
  }

  useEffect(() => { load() }, [])

  async function submit(e) {
    e.preventDefault()
    try {
      const res = await apiFetch('/alerts', {
        method: 'POST',
        body: JSON.stringify({ device_id: deviceId, alert_type: alertType, message, severity })
      })
      if (res.ok) {
        setMessage('')
        setInfo('Alerta creada exitosamente')
        setShowForm(false)
        load()
        setTimeout(() => setInfo(''), 4000)
      }
    } catch (err) {
      setInfo('Error de red al registrar la alerta')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      
      {/* Feedback Banner */}
      {info && (
        <div style={{
          padding: '0.85rem 1.25rem',
          background: info.includes('Error') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${info.includes('Error') ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
          color: info.includes('Error') ? '#f87171' : '#34d399',
          borderRadius: '8px',
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <span>{info}</span>
          <button onClick={() => setInfo('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
        </div>
      )}

      {/* Header & Form Card */}
      <div className="card" style={{ background: 'var(--card-bg, #111827)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Monitoreo de Alertas</h2>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.25rem' }}>Gestione y configure notificaciones automatizadas del sistema.</p>
          </div>
          {!showForm && (
            <button 
              type="button" 
              className="button" 
              onClick={() => setShowForm(true)}
              style={{
                background: '#4f46e5',
                color: '#ffffff',
                border: 'none',
                padding: '0.625rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>+</span> Crear Alerta
            </button>
          )}
        </div>

        {showForm && (
          <form onSubmit={submit} style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
                Dispositivo
                <select 
                  value={deviceId} 
                  onChange={e => setDeviceId(e.target.value)}
                  style={{ background: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', padding: '0.625rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                >
                  <option value="">Seleccionar dispositivo</option>
                  {devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
                Tipo de alerta
                <input 
                  value={alertType} 
                  onChange={e => setAlertType(e.target.value)} 
                  placeholder="device_offline" 
                  style={{ background: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', padding: '0.625rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
                Severidad
                <select 
                  value={severity} 
                  onChange={e => setSeverity(e.target.value)}
                  style={{ background: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', padding: '0.625rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                >
                  <option value="low">Baja</option>
                  <option value="medium">Media</option>
                  <option value="high">Alta</option>
                </select>
              </label>

              <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 500 }}>
                Mensaje
                <input 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Detalle de la alerta o descripción del evento" 
                  style={{ background: '#1f2937', border: '1px solid #374151', color: '#f3f4f6', padding: '0.625rem', borderRadius: '6px', fontSize: '0.9rem', outline: 'none' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button 
                type="submit"
                style={{ background: '#4f46e5', color: '#ffffff', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
              >
                Guardar Alerta
              </button>
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #374151', padding: '0.625rem 1.25rem', borderRadius: '6px', fontWeight: 500, cursor: 'pointer' }}
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List Component Section */}
      <CollectionList
        title="Alertas recientes"
        items={alerts}
        render={alert => (
          <div key={alert.id} className="item-card" style={{ background: 'var(--card-bg, #111827)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f3f4f6', margin: 0 }}>{alert.alert_type}</h3>
              <span className={`badge ${alert.severity}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '9999px', textTransform: 'uppercase', fontWeight: 600, background: alert.severity === 'high' ? 'rgba(239, 68, 68, 0.2)' : alert.severity === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: alert.severity === 'high' ? '#f87171' : alert.severity === 'medium' ? '#fbbf24' : '#60a5fa' }}>
                {alert.severity}
              </span>
            </div>
            <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: 0 }}>{alert.message}</p>
            <span className="meta" style={{ color: '#6b7280', fontSize: '0.75rem' }}>{new Date(alert.created_at).toLocaleString()}</span>
          </div>
        )}
      />
    </div>
  )
}

function AppHeader() {
  const { user } = useAuth()
  return (
    <header className="app-header">
      <div style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ color: 'var(--primary)' }}>•</span> Panel General
      </div>
      {user && (
        <div className="user-badge">
          <div className="avatar-circle">{(user.username || user.email || 'U')[0].toUpperCase()}</div>
          <span>{user.username || user.email}</span>
        </div>
      )}
    </header>
  )
}

function AppContent() {
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => setRoute(normalizeRoute(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const ROUTES_MAP = {
  '/patients': Patients,
  '/dashboard': Dashboard,
  '/users': Users,
  '/locations': Locations,
  '/devices': Devices,
  '/consultations': Consultations,
  '/appointments': Appointments,
  '/profile': Profile,
  '/documents': Documents,
  '/reports': Reports,
  '/alerts': Alerts,
  '/DeviceManagementDashboard': DeviceManagementDashboard,
}

const DefaultPanel = () => (
  <div className="card">
    <h2>Panel Principal</h2>
    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
      Pase el cursor sobre el extremo izquierdo para acceder al menú de navegación.
    </p>
  </div>
)

const renderRoute = () => {
  const ActiveComponent = ROUTES_MAP[route]
  return ActiveComponent ? <ActiveComponent /> : <DefaultPanel />
}
}

function MainApp() {
  const { user, loading } = useAuth()
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => setRoute(normalizeRoute(window.location.hash))
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#fff', background: '#090d16' }}>
        Cargando interfaz...
      </div>
    )
  }

  if (!user) return <Login />

  if (route === '/register' || route === '/login') {
    window.location.hash = '#/dashboard'
    return null
  }

  return <AppContent />
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}