import React, { useState, useEffect } from 'react'
import './styles.css'
import { Patients, Consultations, Appointments, Documents, Reports, Locations, Devices, Dashboard, Users, Profile } from './hospitalModules'
import { apiFetch } from './api'
import { useAuth, AuthProvider } from './AuthContext'


const normalizeRoute = (hash) => {
  const route = String(hash || '').replace(/^#/, '')
  if (!route || route === '/' || route === '/home') {
    return '/login'
  }
  return route
}

function Sidebar({ isCollapsed, onToggle, currentRoute }) {
  const { user, logout } = useAuth()
  const [openSections, setOpenSections] = useState({
    dashboard: true,
    clinical: true,
    operations: true,
    users: true,
    reports: true,
    account: true
  })

  const hasPermission = (permission) => {
    const permissions = user?.permissions || user?.user_metadata?.permissions || []
    return Boolean(permissions.includes(permission))
  }

  const navGroups = [
    {
      key: 'dashboard',
      title: 'Panel',
      icon: '🏠',
      items: [{ label: 'Dashboard', path: '/dashboard' }]
    },
    {
      key: 'clinical',
      title: 'Gestión clínica',
      icon: '🩺',
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
      icon: '⚙️',
      items: [
        { label: 'Ubicaciones', path: '/locations' },
        { label: 'Dispositivos', path: '/devices' },
        { label: 'Alertas', path: '/alerts' },
        { label: 'Métricas', path: '/metrics' }
      ]
    },
    {
      key: 'users',
      title: 'Gestión de usuarios',
      icon: '👥',
      items: [{ label: 'Usuarios', path: '/users', permission: 'manage_users' }]
    },
    {
      key: 'reports',
      title: 'Informes',
      icon: '📊',
      items: [{ label: 'Reportes', path: '/reports' }]
    },
    {
      key: 'account',
      title: 'Cuenta',
      icon: '👤',
      items: [{ label: 'Perfil', path: '/profile' }]
    }
  ]

  const toggleSection = (key) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : 'open'}`}>
      <div className="sidebar-header">
        <button type="button" className="sidebar-toggle" onClick={onToggle} aria-label={isCollapsed ? 'Expandir menú' : 'Ocultar menú'}>
          ☰
        </button>
        <div className="sidebar-header-copy">
          <div className="sidebar-brand">Hospital TIC</div>
          <p className="sidebar-subtitle">Panel de control</p>
        </div>
      </div>

      <div className="sidebar-welcome">
        <span>Hola,</span>
        <strong>{user?.username || user?.email || 'Invitado'}</strong>
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
          <button type="button" className="button secondary sidebar-logout" onClick={logout}>Cerrar sesión</button>
        ) : (
          <a href="#/login" className="button secondary sidebar-logout">Login</a>
        )}
      </div>
    </aside>
  )
}

function AuthenticationForm({ mode, onLoginSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()

  async function submit(e) {
    e.preventDefault()
    if (!email || !password) {
      setMessageType('error')
      setMessage('Por favor ingresa correo y contraseña.')
      return
    }
    setLoading(true)
    setMessage('')
    setMessageType('')
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
      setMessageType('success')
      setMessage('Autenticación correcta. Redirigiendo...')
      
      if (onLoginSuccess) {
        onLoginSuccess()
      } else {
        setTimeout(() => { window.location.hash = '#/dashboard' }, 500)
      }
    } catch (err) {
      setMessageType('error')
      setMessage(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const altText = mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'
  const altLink = mode === 'login' ? '#/register' : '#/login'
  const altAction = mode === 'login' ? 'Regístrate ahora' : 'Inicia sesión'

  return (
    <div className="auth-page">
      <div className="card form-card">
        <h2>{mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}</h2>
        <p className="form-intro">
          {mode === 'login'
            ? 'Ingresa tus credenciales para ver el panel de control hospitalario.'
            : 'Regístrate para comenzar a gestionar ubicaciones, dispositivos y alertas.'}
        </p>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Correo Electrónico / Usuario
              <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@ejemplo.com" disabled={loading} />
            </label>
            <label>
              Contraseña
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="contraseña" disabled={loading} />
            </label>
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Procesando...' : (mode === 'login' ? 'Iniciar sesión' : 'Registrarse')}</button>
        </form>
        {message && <div className={messageType === 'success' ? 'message' : 'error'}>{message}</div>}
        <div className="form-footer">
          <span>{altText}</span>
          <a className="link-action" href={altLink}>{altAction}</a>
        </div>
      </div>
    </div>
  )
}

function CollectionList({ title, items = [], render, filters = [] }) {
  const [query, setQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState(filters.length ? filters[0].value : 'all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    setCurrentPage(1)
  }, [query, activeFilter, items])

  const normalizedQuery = query.toLowerCase().trim()
  const filteredItems = items.filter(item => {
    const searchMatch = !normalizedQuery || JSON.stringify(item).toLowerCase().includes(normalizedQuery)
    const filter = filters.find(f => f.value === activeFilter)
    const filterMatch = !filter || activeFilter === 'all' || filter.predicate(item)
    return searchMatch && filterMatch
  })

  const pageSize = filteredItems.length > 15 ? 15 : 10
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const pageStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(filteredItems.length, currentPage * pageSize)
  const pageItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="card collection-card">
      <div className="collection-header">
        <h2>{title}</h2>
        <span className="collection-count">
          Total: {filteredItems.length} elementos
          {filteredItems.length > pageSize && ` · mostrando ${pageStart}-${pageEnd}`}
        </span>
      </div>
      <div className="collection-toolbar">
        <label className="collection-search">
          <span>Buscar</span>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar en la lista..." />
        </label>
        {filters.length > 0 && (
          <label className="collection-filter">
            <span>Filtro</span>
            <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}>
              {filters.map(filter => (
                <option key={filter.value} value={filter.value}>{filter.label}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {items.length === 0 ? (
        <p className="muted">No hay elementos aún.</p>
      ) : filteredItems.length === 0 ? (
        <p className="muted">No se encontraron elementos para esa búsqueda.</p>
      ) : (
        <>
          <div className="items-grid">
            {pageItems.map(item => render(item))}
          </div>
          {filteredItems.length > pageSize && (
            <div className="pagination-footer">
              <button type="button" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button>
              <span>Página {currentPage} de {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</button>
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
      const json = await res.json()
      if (res.ok) {
        setMessage('')
        setInfo('Alerta creada')
        setShowForm(false)
        load()
      } else {
        setInfo(json.message || 'Error al crear alerta')
      }
    } catch (err) {
      setInfo('Error de red al registrar la alerta')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header-row">
          <h2>Alertas</h2>
          {!showForm && (
            <button type="button" className="button add-button" onClick={() => setShowForm(true)}>
              Agregar
            </button>
          )}
        </div>
        {showForm && (
          <div className="card form-card">
            <h2>Registrar alerta</h2>
            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Dispositivo
                  <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                    <option value="">Seleccionar dispositivo</option>
                    {devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
                  </select>
                </label>
                <label>
                  Tipo de alerta
                  <input value={alertType} onChange={e => setAlertType(e.target.value)} placeholder="device_offline" />
                </label>
                <label>
                  Mensaje
                  <input value={message} onChange={e => setMessage(e.target.value)} placeholder="Descripción de la alerta" />
                </label>
                <label>
                  Severidad
                  <select value={severity} onChange={e => setSeverity(e.target.value)}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </label>
              </div>
              <div className="button-row">
                <button type="submit">Crear alerta</button>
                <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              </div>
            </form>
            {info && <div className="form-message">{info}</div>}
          </div>
        )}
      </div>
      <CollectionList
        title="Alertas recientes"
        items={alerts}
        render={alert => (
          <div key={alert.id} className="item-card">
            <h3>{alert.alert_type}</h3>
            <p>{alert.message}</p>
            <span className={`badge ${alert.severity}`}>{alert.severity}</span>
            <span className="meta">Creado: {new Date(alert.created_at).toLocaleString()}</span>
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
      {user && <span>Bienvenido, {user.username || user.email}</span>}
    </header>
  )
}

function AppContent() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [route, setRoute] = useState(() => normalizeRoute(window.location.hash))

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(normalizeRoute(window.location.hash))
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const renderRoute = () => {
    switch (route) {
      case '/patients':
        return <Patients />
      case '/dashboard':
        return <Dashboard />
      case '/device_actions':
        return <DeviceActions />
      case '/users':
        return <Users />
      case '/locations':
        return <Locations />
      case '/devices':
        return <Devices />
      case '/consultations':
        return <Consultations />
      case '/appointments':
        return <Appointments />
      case '/profile':
        return <Profile />
      case '/documents':
        return <Documents />
      case '/reports':
        return <Reports />
      case '/alerts':
        return <Alerts />
      case '/dashboard':
      default:
        return (
          <div className="card">
            <h2>Panel principal</h2>
            <p>Bienvenido al panel de control del Hospital TIC.</p>
          </div>
        )
    }
  }

  return (
    <div className="app-layout">
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        currentRoute={route}
      />
      <main className="main-content">
        <AppHeader />
        {renderRoute()}
      </main>
    </div>
  )
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        Cargando...
      </div>
    )
  }

  if (!user) {
    const authMode = route === '/register' ? 'register' : 'login'
    return <AuthenticationForm mode={authMode} onLoginSuccess={() => { window.location.hash = '#/dashboard' }} />
  }

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