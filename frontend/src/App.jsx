import React, { useState, useEffect, useMemo } from 'react'
import './styles.css'
import { Patients, Consultations, Appointments, Documents, Reports } from './hospitalModules'
import { apiFetch } from './api'
import { useAuth, AuthProvider } from './AuthContext'

function Sidebar({ isCollapsed, onToggle }){
  const { profile, logout, theme, setTheme, hasPermission } = useAuth()
  const authenticated = Boolean(profile)
  const [route, setRoute] = useState(location.hash.replace('#','') || '/')
  const [openSections, setOpenSections] = useState({
    dashboard: true,
    clinical: true,
    operations: true,
    users: true,
    reports: true,
    account: true
  })

  useEffect(() => {
    const onHashChange = () => setRoute(location.hash.replace('#','') || '/')
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const navGroups = [
    {
      key: 'dashboard',
      title: 'Panel',
      icon: '🏠',
      items: [
        { label: 'Dashboard', path: '/dashboard' }
      ]
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
      items: [
        { label: 'Usuarios', path: '/users', permission: 'manage_users' }
      ]
    },
    {
      key: 'reports',
      title: 'Informes',
      icon: '📊',
      items: [
        { label: 'Reportes', path: '/reports' }
      ]
    },
    {
      key: 'account',
      title: 'Cuenta',
      icon: '👤',
      items: [
        { label: 'Perfil', path: '/profile' }
      ]
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
        <button className="sidebar-theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="sidebar-welcome">
        <span>Hola,</span>
        <strong>{profile?.username || 'Invitado'}</strong>
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
                    <a key={item.path} href={`#${item.path}`} className={`sidebar-item ${route === item.path ? 'active' : ''}`}>
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
        {authenticated ? (
          <button type="button" className="button secondary sidebar-logout" onClick={logout}>Cerrar sesión</button>
        ) : (
          <a href="#/login" className="button secondary sidebar-logout">Login</a>
        )}
      </div>
    </aside>
  )
}

function Home(){
  const { theme, setTheme } = useAuth()
  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Soluciones TIC para hospitales</span>
          <h1>Control total de equipos clínicos con una experiencia limpia y segura</h1>
          <p>Una plataforma diseñada para profesionales de salud que necesitan visibilidad inmediata, respuesta más rápida y gestión inteligente de dispositivos, alertas y métricas.</p>
          <div className="hero-actions">
            <a className="button" href="#/login">Ingresar ahora</a>
            <a className="button secondary" href="#/register">Ver demo gratis</a>
          </div>
          <div className="hero-trust">
            <div className="trust-item">
              <strong>120+</strong>
              hospitales conectados
            </div>
            <div className="trust-item">
          <button className="link-button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀️' : '🌙'}</button>
              <strong>24/7</strong>
              supervisión continua
            </div>
            <div className="trust-item">
              <strong>99.9%</strong>
              disponibilidad
            </div>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-card panel-hero">
            <span className="panel-label">Panel rápido</span>
            <h3>Todo el estado hospitalario en un solo vistazo</h3>
            <p>Alertas, dispositivos y métricas se muestran en tarjetas claras para que los equipos actúen de inmediato.</p>
            <div className="panel-summary">
              <div>
                <strong>4</strong>
                alarmas activas
              </div>
              <div>
                <strong>18</strong>
                dispositivos críticos
              </div>
            </div>
          </div>
          <div className="panel-card">
            <span className="panel-label">Alertas</span>
            <h3>Estado de dispositivos</h3>
            <p>Visualiza los equipos con fallas y optimiza el mantenimiento antes de la emergencia.</p>
          </div>
          <div className="panel-card">
            <span className="panel-label">Métricas</span>
            <h3>Resultados inmediatos</h3>
            <p>Accede a datos clínicos y operativos que apoyan decisiones rápidas y seguras.</p>
          </div>
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature-card large-card">
          <h3>Funciona como una sala de control</h3>
          <p>Centraliza la operación clínica, prioriza incidentes y coordina las respuestas del equipo desde una única vista.</p>
        </div>
        <div className="feature-card">
          <h3>Datos procesables</h3>
          <p>Visibilidad en tiempo real para métricas de dispositivos, alertas y salud operativa.</p>
        </div>
        <div className="feature-card">
          <h3>Equipos alineados</h3>
          <p>Roles y permisos claros permiten al personal correcto tomar acción con la información adecuada.</p>
        </div>
      </section>

      <section className="summary-section">
        <div className="summary-card highlight">
          <strong>Un solo sistema</strong>
          <p>Gestiona ubicaciones, equipos, alertas y métricas sin cambiar de plataforma.</p>
        </div>
        <div className="summary-card">
          <strong>Resultados confiables</strong>
          <p>Reduce tiempos de respuesta y mejora la continuidad operativa del hospital.</p>
        </div>
        <div className="summary-card">
          <strong>Adaptable y seguro</strong>
          <p>Construido para crecer con tu organización y proteger los datos clínicos.</p>
        </div>
      </section>

      <section className="steps-section">
        <div className="step-card">
          <span>1</span>
          <h3>Conecta tus ubicaciones</h3>
          <p>Registra áreas y asigna dispositivos con facilidad.</p>
        </div>
        <div className="step-card">
          <span>2</span>
          <h3>Supervisa alertas</h3>
          <p>Recibe notificaciones a tiempo real y prioriza fallas críticas.</p>
        </div>
        <div className="step-card">
          <span>3</span>
          <h3>Activa decisiones</h3>
          <p>Usa métricas y reportes para mejorar la seguridad y la eficiencia.</p>
        </div>
      </section>

      <section className="info-banner">
        <div>
          <h2>Todo el respaldo que necesita un hospital moderno</h2>
          <p>Desde atención de turno hasta gestión de activos, nuestra plataforma combina claridad visual con un flujo de trabajo homogéneo.</p>
        </div>
      </section>
    </div>
  )
}

function AuthenticationForm({ mode }){
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [role,setRole]=useState('viewer')
  const [message,setMessage]=useState('')
  const [messageType,setMessageType]=useState('')
  const [loading,setLoading]=useState(false)
  const { login, register } = useAuth()
  async function submit(e){
    e.preventDefault()
    if (!username || !password){
      setMessageType('error')
      setMessage('Por favor ingresa usuario y contraseña.')
      return
    }
    setLoading(true)
    setMessage('')
    setMessageType('')
    try{
      if (mode === 'login'){
        await login(username, password)
      } else {
        await register(username, password)
      }
      setMessageType('success')
      setMessage('Autenticación correcta. Redirigiendo...')
      setTimeout(() => { window.location.hash = '#/dashboard' }, 500)
    }catch(err){
      setMessageType('error')
      setMessage(err.message || 'Error inesperado')
    }finally{
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
              Usuario
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="usuario" disabled={loading} />
            </label>
            <label>
              Contraseña
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="contraseña" disabled={loading} />
            </label>
          </div>
          {/* Role selection is restricted server-side; registration keeps it simple */}
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

function SummaryCard({ label, value }){
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}

function Dashboard(){
  const [summary,setSummary]=useState(null)
  const [error,setError]=useState('')

  useEffect(()=>{
    apiFetch('/dashboard').then(async r=>{
      if (!r.ok){
        setError((await r.json()).message || 'No se pudo cargar el panel')
        return
      }
      setSummary(await r.json())
    }).catch(()=>setError('Error de red'))
  },[])

  return (
    <div className="card">
      <h2>Dashboard operativo</h2>
      {error && <div className="error">{error}</div>}
      {summary ? (
        <div className="stats-grid">
          <SummaryCard label="Usuarios" value={summary.users} />
          <SummaryCard label="Pacientes" value={summary.patients} />
          <SummaryCard label="Ubicaciones" value={summary.locations} />
          <SummaryCard label="Dispositivos" value={summary.devices} />
          <SummaryCard label="Alertas" value={summary.alerts} />
          <SummaryCard label="Citas" value={summary.appointments} />
          <SummaryCard label="Consultas" value={summary.consultations} />
          <SummaryCard label="Métricas" value={summary.metrics} />
        </div>
      ) : <p>Cargando...</p>}
    </div>
  )
}

function UserManagement(){
  const [users,setUsers]=useState([])
  const [roles,setRoles]=useState({})
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [role,setRole]=useState('viewer')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [selectedUser,setSelectedUser]=useState(null)
  const [newPassword,setNewPassword]=useState('')
  const [newRole,setNewRole]=useState('viewer')

  async function load(){
    const [usersRes, rolesRes] = await Promise.all([apiFetch('/users'), apiFetch('/roles')])
    if (!usersRes.ok){
      const json = await usersRes.json()
      setError(json.message || 'No se pudo cargar usuarios')
      return
    }
    if (!rolesRes.ok){
      const json = await rolesRes.json()
      setError(json.message || 'No se pudo cargar roles')
      return
    }
    setUsers(await usersRes.json())
    setRoles(await rolesRes.json())
  }

  useEffect(()=>{ load() }, [])

  async function createUser(e){
    e.preventDefault()
    setLoading(true)
    const res = await apiFetch('/users', {
      method:'POST',
      body: JSON.stringify({username, password, role})
    })
    const json = await res.json()
    setLoading(false)
    if (res.ok){
      setMessage('Usuario creado')
      setUsername('')
      setPassword('')
      setRole('viewer')
      load()
    } else {
      setError(json.message || 'Error al crear usuario')
    }
  }

  async function updateUser(){
    if (!selectedUser) return
    const payload = {}
    if (newRole) payload.role = newRole
    if (newPassword) payload.password = newPassword
    const res = await apiFetch(`/users/${selectedUser.id}`, {
      method:'PUT',
      body: JSON.stringify(payload)
    })
    const json = await res.json()
    if (res.ok){
      setMessage('Usuario actualizado')
      setSelectedUser(null)
      setNewPassword('')
      load()
    } else {
      setError(json.message || 'Error al actualizar usuario')
    }
  }

  async function deleteUser(userId){
    if (!window.confirm('¿Eliminar este usuario?')) return
    const res = await apiFetch(`/users/${userId}`, {method:'DELETE'})
    const json = await res.json()
    if (res.ok){
      setMessage('Usuario eliminado')
      load()
    } else {
      setError(json.message || 'Error al eliminar usuario')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Gestión de usuarios</h2>
        <form onSubmit={createUser}>
          <div className="form-grid">
            <label>
              Usuario
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Nombre de usuario" />
            </label>
            <label>
              Contraseña
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" />
            </label>
            <label>
              Rol
              <select value={role} onChange={e=>setRole(e.target.value)}>
                {Object.keys(roles).map(roleKey => (
                  <option key={roleKey} value={roleKey}>{roles[roleKey].name}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear usuario'}</button>
        </form>
        {message && <div className="message">{message}</div>}
        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h2>Usuarios existentes</h2>
        {users.length === 0 ? <p className="muted">No hay usuarios registrados.</p> : (
          <div className="items-grid">
            {users.map(user => (
              <div key={user.id} className="item-card">
                <h3>{user.username}</h3>
                <p>Rol: {user.role}</p>
                <p>Tenant: {user.tenant_id}</p>
                <p>Creado: {new Date(user.created_at).toLocaleString()}</p>
                <div className="button-row">
                  <button type="button" onClick={() => {
                    setSelectedUser(user)
                    setNewRole(user.role)
                  }}>Editar</button>
                  <button type="button" className="danger" onClick={() => deleteUser(user.id)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="card form-card">
          <h2>Actualizar usuario: {selectedUser.username}</h2>
          <div className="form-grid">
            <label>
              Nuevo rol
              <select value={newRole} onChange={e=>setNewRole(e.target.value)}>
                {Object.keys(roles).map(roleKey => (
                  <option key={roleKey} value={roleKey}>{roles[roleKey].name}</option>
                ))}
              </select>
            </label>
            <label>
              Nueva contraseña
              <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="Nueva contraseña (opcional)" />
            </label>
          </div>
          <div className="button-row">
            <button type="button" onClick={updateUser}>Guardar cambios</button>
            <button type="button" className="secondary" onClick={() => setSelectedUser(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CollectionList({ title, items, render, filters = [] }){
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

function Locations(){
  const [locations,setLocations]=useState([])
  const [name,setName]=useState('')
  const [description,setDescription]=useState('')
  const [message,setMessage]=useState('')

  async function load(){
    const res = await apiFetch('/locations')
    if (res.ok) setLocations(await res.json())
    else setMessage('No se pudo cargar las ubicaciones')
  }

  useEffect(()=>{ load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/locations', {method:'POST', body: JSON.stringify({name, description})})
    const json = await res.json()
    if (res.ok){
      setName('')
      setDescription('')
      setMessage('Ubicación creada')
      load()
    } else {
      setMessage(json.message || 'Error al crear ubicación')
    }
  }

  return (
    <div className="location-page">
      <div className="card form-card">
        <h2>Agregar ubicación</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Nombre
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre de la ubicación" />
            </label>
            <label>
              Descripción
              <input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Descripción breve" />
            </label>
          </div>
          <button type="submit">Guardar ubicación</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>
      <CollectionList
        title="Ubicaciones"
        items={locations}
        filters={[
          { value: 'all', label: 'Todos', predicate: () => true },
          { value: 'hasDescription', label: 'Con descripción', predicate: item => Boolean(item.description?.trim()) },
          { value: 'noDescription', label: 'Sin descripción', predicate: item => !item.description?.trim() }
        ]}
        render={loc => (
          <div key={loc.id} className="item-card">
            <h3>{loc.name}</h3>
            <p>{loc.description}</p>
            <span className="meta">Creado: {new Date(loc.created_at).toLocaleString()}</span>
          </div>
        )}
      />
    </div>
  )
}

function Devices(){
  const [devices,setDevices]=useState([])
  const [locations,setLocations]=useState([])
  const [name,setName]=useState('')
  const [type,setType]=useState('monitor')
  const [status,setStatus]=useState('active')
  const [locationId,setLocationId]=useState('')
  const [message,setMessage]=useState('')

  async function load(){
    const [devicesRes, locationsRes] = await Promise.all([apiFetch('/devices'), apiFetch('/locations')])
    if (devicesRes.ok) setDevices(await devicesRes.json())
    if (locationsRes.ok) setLocations(await locationsRes.json())
  }

  useEffect(()=>{ load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/devices', {
      method:'POST',
      body: JSON.stringify({name, type, status, location_id: locationId || null})
    })
    const json = await res.json()
    if (res.ok){
      setName('')
      setType('monitor')
      setStatus('active')
      setLocationId('')
      setMessage('Dispositivo agregado')
      load()
    } else {
      setMessage(json.message || 'Error al crear dispositivo')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Agregar dispositivo</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Nombre
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del dispositivo" />
            </label>
            <label>
              Tipo
              <input value={type} onChange={e=>setType(e.target.value)} placeholder="Tipo (monitor, ventilador, etc.)" />
            </label>
            <label>
              Estado
              <input value={status} onChange={e=>setStatus(e.target.value)} placeholder="active, maintenance, offline" />
            </label>
            <label>
              Ubicación
              <select value={locationId} onChange={e=>setLocationId(e.target.value)}>
                <option value="">Seleccionar ubicación</option>
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            </label>
          </div>
          <button type="submit">Guardar dispositivo</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>
      <CollectionList
        title="Dispositivos"
        items={devices}
        render={device => (
          <div key={device.id} className="item-card">
            <h3>{device.name}</h3>
            <p>{device.type} — {device.status}</p>
            <p>{device.location_name || 'Sin ubicación'}</p>
            <span className="meta">Creado: {new Date(device.created_at).toLocaleString()}</span>
          </div>
        )}
      />
    </div>
  )
}

function Alerts(){
  const [alerts,setAlerts]=useState([])
  const [devices,setDevices]=useState([])
  const [deviceId,setDeviceId]=useState('')
  const [alertType,setAlertType]=useState('device_offline')
  const [message,setMessage]=useState('')
  const [severity,setSeverity]=useState('medium')
  const [info,setInfo]=useState('')

  async function load(){
    const [alertsRes, devicesRes] = await Promise.all([apiFetch('/alerts'), apiFetch('/devices')])
    if (alertsRes.ok) setAlerts(await alertsRes.json())
    if (devicesRes.ok) setDevices(await devicesRes.json())
  }

  useEffect(()=>{ load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/alerts', {
      method: 'POST',
      body: JSON.stringify({device_id: deviceId, alert_type: alertType, message, severity})
    })
    const json = await res.json()
    if (res.ok){
      setMessage('')
      setInfo('Alerta creada')
      load()
    } else {
      setInfo(json.message || 'Error al crear alerta')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Registrar alerta</h2>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>
              Dispositivo
              <select value={deviceId} onChange={e=>setDeviceId(e.target.value)}>
                <option value="">Seleccionar dispositivo</option>
                {devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
              </select>
            </label>
            <label>
              Tipo de alerta
              <input value={alertType} onChange={e=>setAlertType(e.target.value)} placeholder="device_offline" />
            </label>
            <label>
              Mensaje
              <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Descripción de la alerta" />
            </label>
            <label>
              Severidad
              <select value={severity} onChange={e=>setSeverity(e.target.value)}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>
          <button type="submit">Crear alerta</button>
        </form>
        {info && <div className="form-message">{info}</div>}
      </div>
      <CollectionList
        title="Alertas recientes"
        items={alerts}
        render={alert => (
          <div key={alert.id} className="item-card">
            <h3>{alert.alert_type}</h3>
            <p>{alert.message}</p>
            <p>{alert.severity} — {alert.device_name || 'Dispositivo no asignado'}</p>
            <span className="meta">Estado: {alert.is_resolved ? 'Resuelto' : 'Abierto'}</span>
          </div>
        )}
      />
    </div>
  )
}

function Metrics(){
  const [metrics,setMetrics]=useState([])
  const [devices,setDevices]=useState([])
  const [deviceId,setDeviceId]=useState('')
  const [metricType,setMetricType]=useState('heart_rate')
  const [value,setValue]=useState('')
  const [unit,setUnit]=useState('bpm')
  const [info,setInfo]=useState('')

  async function load(){
    const [metricsRes, devicesRes] = await Promise.all([apiFetch('/metrics'), apiFetch('/devices')])
    if (metricsRes.ok) setMetrics(await metricsRes.json())
    if (devicesRes.ok) setDevices(await devicesRes.json())
  }

  useEffect(()=>{ load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/metrics', {
      method: 'POST',
      body: JSON.stringify({device_id: deviceId, metric_type: metricType, value, unit})
    })
    const json = await res.json()
    if (res.ok){
      setValue('')
      setInfo('Métrica registrada')
      load()
    } else {
      setInfo(json.message || 'Error al registrar métrica')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Registrar métrica</h2>
        <form onSubmit={submit}>
          <label>
            Dispositivo
            <select value={deviceId} onChange={e=>setDeviceId(e.target.value)}>
              <option value="">Seleccionar dispositivo</option>
              {devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}
            </select>
          </label>
          <label>
            Tipo de métrica
            <input value={metricType} onChange={e=>setMetricType(e.target.value)} placeholder="heart_rate" />
          </label>
          <label>
            Valor
            <input value={value} onChange={e=>setValue(e.target.value)} placeholder="78" />
          </label>
          <label>
            Unidad
            <input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="bpm" />
          </label>
          <button type="submit">Guardar métrica</button>
        </form>
        {info && <div className="form-message">{info}</div>}
      </div>
      <CollectionList
        title="Métricas recientes"
        items={metrics}
        render={metric => (
          <div key={metric.id} className="item-card">
            <h3>{metric.metric_type}</h3>
            <p>{metric.value} {metric.unit}</p>
            <p>{metric.device_name || 'Dispositivo no asignado'}</p>
            <span className="meta">Registrado: {new Date(metric.recorded_at).toLocaleString()}</span>
          </div>
        )}
      />
    </div>
  )
}

function Profile(){
  const { profile, loading } = useAuth()
  return (
    <div className="card">
      <h2>Perfil</h2>
      {loading && <p>Cargando perfil...</p>}
      {!loading && profile && (
        <div className="profile-grid">
          <div>
            <strong>Usuario</strong>
            <p>{profile.username}</p>
          </div>
          <div>
            <strong>Rol</strong>
            <p>{profile.role}</p>
          </div>
          <div>
            <strong>Tenant</strong>
            <p>{profile.tenant_id}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function NotFound(){
  return (
    <div className="card">
      <h2>Página no encontrada</h2>
      <p>La ruta solicitada no existe. Usa el menú para navegar.</p>
    </div>
  )
}

function Unauthorized(){
  return (
    <div className="card">
      <h2>Acceso denegado</h2>
      <p>No tienes permisos para ver esta sección.</p>
    </div>
  )
}

function AppContent(){
  const [route,setRoute]=useState(location.hash.replace('#','') || '/')
  const [isSidebarOpen,setIsSidebarOpen]=useState(true)
  const { profile } = useAuth()

  useEffect(()=>{
    function onHash(){ setRoute(location.hash.replace('#','') || '/') }
    window.addEventListener('hashchange', onHash)
    return ()=> window.removeEventListener('hashchange', onHash)
  },[])

  useEffect(() => {
    if (showSidebar) {
      setIsSidebarOpen(true)
    }
  }, [route])

  const showSidebar = Boolean(profile) && route !== '/login' && route !== '/register'

  const Page = useMemo(() => {
    if (route === '/') return <Home />
    if (route === '/login') return <AuthenticationForm mode="login" />
    if (route === '/register') return <AuthenticationForm mode="register" />
    if (route === '/dashboard') return <Dashboard />
    if (route === '/patients') return <Patients />
    if (route === '/consultations') return <Consultations />
    if (route === '/appointments') return <Appointments />
    if (route === '/documents') return <Documents />
    if (route === '/locations') return <Locations />
    if (route === '/devices') return <Devices />
    if (route === '/alerts') return <Alerts />
    if (route === '/metrics') return <Metrics />
    if (route === '/users') return profile?.permissions?.includes('manage_users') ? <UserManagement /> : <Unauthorized />
    if (route === '/reports') return <Reports />
    if (route === '/profile') return <Profile />
    return <NotFound />
  }, [route, profile])

  return (
    <div className={`app-shell ${showSidebar ? '' : 'no-sidebar'}`}>
      {showSidebar && (
        <Sidebar isCollapsed={!isSidebarOpen} onToggle={() => setIsSidebarOpen(value => !value)} />
      )}
      <main className={showSidebar ? 'content' : 'page-center'}>{Page}</main>
    </div>
  )
}

export default function App(){
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
