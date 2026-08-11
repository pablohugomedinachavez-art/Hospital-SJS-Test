import React, { useEffect, useState } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from './api'; // o '../api' según la ubicación del archivo
import { apiFetch } from './api';
import { useAuth } from './AuthContext'
// Ejemplo de consulta de pacientes
const loadPatients = async () => {
  try {
    const res = await api.get('/patients');
    if (res.ok) {
      const data = await res.json();
      console.log('Pacientes:', data);
    }
  } catch (error) {
    console.error('Error al cargar pacientes:', error);
  }
};
const phoneConfigs = {
  '+51': { country: 'Perú', length: 9 },
  '+52': { country: 'México', length: 10 },
  '+54': { country: 'Argentina', length: 10 },
  '+57': { country: 'Colombia', length: 9 },
  '+1': { country: 'Estados Unidos', length: 10 }
}

export function Patients() {
  const [patients, setPatients] = useState([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState('list')
  const [form, setForm] = useState({
    document_type: 'dni',
    document_number: '',
    full_name: '',
    date_of_birth: '',
    phone_country: '+51',
    phone_number: '',
    email: '',
    sex: '',
    blood_type: '',
    allergies: ''
  })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'tenant_admin'

  async function load(q = '') {
    try {
      const res = await apiFetch(`/patients?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setPatients(data || [])
      } else {
        setMessage('Error al cargar la lista de pacientes.')
      }
    } catch (err) {
      console.error('Error de red al cargar pacientes:', err)
    }
  }

  useEffect(() => { load() }, [])

  async function deletePatient(patientId) {
    if (!window.confirm('¿Seguro que deseas eliminar este paciente? Esta acción no se puede deshacer.')) {
      return
    }
    const res = await apiFetch('/patients', { method: 'DELETE', body: JSON.stringify({ patient_id: patientId }) })
    if (res.ok) {
      setMessage('Paciente eliminado correctamente')
      await load(query)
    } else {
      const json = await res.json().catch(() => ({}))
      setMessage(json.message || 'Error al eliminar paciente')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      // client-side uniqueness checks for document number, phone, email
      const existingDocument = patients.find(p => p.dni === form.document_number && form.document_number.trim() !== '')
      if (existingDocument) {
        setMessage('El número de documento ya existe para otro paciente')
        setLoading(false)
        return
      }
      const phoneValue = `${form.phone_country}${form.phone_number}`
      const existingPhone = patients.find(p => p.phone === phoneValue && form.phone_number.trim() !== '')
      if (existingPhone) {
        setMessage('El teléfono ya está registrado para otro paciente')
        setLoading(false)
        return
      }
      const existingEmail = patients.find(p => p.email === form.email && form.email.trim() !== '')
      if (existingEmail) {
        setMessage('El correo ya está registrado para otro paciente')
        setLoading(false)
        return
      }
      const res = await apiFetch('/patients', { method: 'POST', body: JSON.stringify({
        ...form,
        phone: phoneValue,
        dni: form.document_number
      }) })
      const json = await res.json()
      if (res.ok) {
        setMessage('Paciente registrado correctamente')
        setForm({ document_type: 'dni', document_number: '', full_name: '', date_of_birth: '', phone_country: '+51', phone_number: '', email: '', sex: '', blood_type: '', allergies: '' })
        setView('list')
        await load(query)
      } else {
        setMessage(json.message || 'No se pudo crear el paciente')
      }
    } catch (err) {
      setMessage('Error de conexión con el servidor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="patients-page">
      <div className="card patients-shell">
        <div className="card-header-row">
          <div>
            <h2>{view === 'create' ? 'Nuevo paciente' : 'Pacientes'}</h2>
            <p className="muted">
              {view === 'create'
                ? 'Completa los datos del paciente en el orden solicitado.'
                : 'Consulta los pacientes registrados y crea nuevos cuando lo necesites.'}
            </p>
          </div>
          {view === 'create' && (
            <button type="button" className="button secondary" onClick={() => { setView('list'); setMessage('') }}>
              Volver
            </button>
          )}
        </div>

        {view === 'create' ? (
          <div className="patients-create-layout">
            <div className="patients-hero-card">
              <h3>Registro rápido</h3>
              <p>Agrega un paciente nuevo para que quede disponible para consultas, citas y documentos.</p>
            </div>

            <form onSubmit={submit}>
              <div className="form-grid">
                <label>
                  Tipo de documento
                  <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value, document_number: '' })}>
                    <option value="dni">DNI</option>
                    <option value="ce">CARNET DE EXTRANJERÍA</option>
                  </select>
                </label>
                <label>
                  Número de documento
                  <input
                    required
                    value={form.document_number}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '')
                      const maxLength = form.document_type === 'dni' ? 8 : 12
                      setForm({ ...form, document_number: value.slice(0, maxLength) })
                    }}
                    placeholder={form.document_type === 'dni' ? '8 dígitos' : 'Hasta 12 dígitos'}
                  />
                </label>
                <label>
                  Nombre completo
                  <input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                </label>
                <label>
                  Fecha de nacimiento
                  <input
                    required
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.date_of_birth}
                    onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
                  />
                </label>
                <label>
                  Código de país
                  <select value={form.phone_country} onChange={e => setForm({ ...form, phone_country: e.target.value, phone_number: '' })}>
                    {Object.entries(phoneConfigs).map(([code, info]) => (
                      <option key={code} value={code}>{code} ({info.country})</option>
                    ))}
                  </select>
                </label>
                <label>
                  Teléfono
                  <input
                    required
                    value={form.phone_number}
                    onChange={e => {
                      const value = e.target.value.replace(/\D/g, '')
                      const maxLength = phoneConfigs[form.phone_country]?.length || 10
                      setForm({ ...form, phone_number: value.slice(0, maxLength) })
                    }}
                    placeholder={`Hasta ${phoneConfigs[form.phone_country]?.length || 10} dígitos`}
                  />
                </label>
                <label>
                  Correo
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Opcional" />
                </label>
                <label>
                  Sexo
                  <select required value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })}>
                    <option value="">Seleccionar sexo</option>
                    <option value="female">Femenino</option>
                    <option value="male">Masculino</option>
                    <option value="other">Otro / Prefiero no decir</option>
                  </select>
                </label>
                <label>
                  Tipo de sangre
                  <select value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })}>
                    <option value="">Seleccionar tipo de sangre</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </label>
                <label>
                  Alergias
                  <input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} />
                </label>
              </div>
                <div className="button-row">
                  <button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Registrar paciente'}</button>
                  <button type="button" className="secondary" onClick={() => { setView('list'); setMessage('') }}>
                    Cancelar
                  </button>
                </div>
              </form>
              {message && <div className="form-message">{message}</div>}
            </div>
        ) : (
          <>
            <div className="patients-toolbar">
              <label className="collection-search">
                <span>Buscar pacientes</span>
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="DNI o nombre"
                />
              </label>
              <div className="button-row patients-actions">
                <button type="button" className="button" onClick={() => { if (!query || !query.trim()) { setMessage('Introduce un DNI o nombre para buscar'); return } load(query) }}>
                  Buscar
                </button>
                <button type="button" className="button secondary" onClick={() => { setView('create'); setMessage('') }}>
                  Agregar
                </button>
              </div>
            </div>

            <div className="patients-list-card">
              {patients.length === 0 ? (
                <div className="patients-empty-state">
                  <div className="patients-empty-icon">🔎</div>
                  <h3>No se encontraron pacientes</h3>
                  <p>Prueba con otros términos de búsqueda o crea un nuevo paciente.</p>
                  <button type="button" className="button" onClick={() => { setView('create'); setMessage('') }}>
                    Crear nuevo paciente
                  </button>
                </div>
              ) : (
                <>
                  <p className="collection-total">Pacientes registrados ({patients.length})</p>
                  <div className="items-grid">
                    {patients.map(patient => (
                      <div key={patient.id} className="item-card">
                        <h3>{patient.full_name}</h3>
                        <p>ID: {patient.id}</p>
                        <p>DNI: {patient.dni}</p>
                        <p>HC: {patient.medical_record_number || '—'}</p>
                        <p>Tel: {patient.phone || '—'}</p>
                        <p>Correo: {patient.email || '—'}</p>
                        <span className="meta">Estado: {patient.status || 'Activo'}</span>
                        {isAdmin && (
                          <button type="button" className="button danger" style={{ marginTop: 8 }} onClick={() => deletePatient(patient.id)}>
                            Eliminar paciente
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Consultations() {
  const [consultations, setConsultations] = useState([])
  const [patients, setPatients] = useState([])
  const [patientQuery, setPatientQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patient_id: '', doctor_name: 'Dr. Demo', reason: '', symptoms: '', diagnosis: '', treatment: '', prescription: '' })
  const [message, setMessage] = useState('')

  async function loadConsultations() {
    const res = await apiFetch('/consultations')
    if (res.ok) setConsultations(await res.json() || [])
  }

  async function searchPatients(query = '') {
    const res = await apiFetch(`/patients?q=${encodeURIComponent(query)}`)
    if (res.ok) {
      const data = await res.json() || []
      setPatients(data)
      return data
    }
    return []
  }

  useEffect(() => {
    loadConsultations()
    searchPatients()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    const res = await apiFetch('/consultations', { method: 'POST', body: JSON.stringify(form) })
    if (res.ok) {
      setMessage('Consulta registrada')
      setForm({ patient_id: '', doctor_name: 'Dr. Demo', reason: '', symptoms: '', diagnosis: '', treatment: '', prescription: '' })
      setShowForm(false)
      loadConsultations()
    } else {
      const json = await res.json().catch(() => ({}))
      setMessage(json.message || 'Error al registrar consulta')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header-row">
          <h2>Registrar consulta médica</h2>
          {!showForm && (
            <button type="button" className="button add-button" onClick={() => { setShowForm(true); setMessage('') }}>
              Agregar
            </button>
          )}
        </div>
        {showForm && (
          <div className="form-card">
            <form onSubmit={submit}>
              <label>
                Buscar DNI del paciente
                <input value={patientQuery} onChange={e => setPatientQuery(e.target.value)} placeholder="DNI o nombre" />
              </label>
              <button type="button" onClick={async () => {
                if (!patientQuery || !patientQuery.trim()) {
                  setMessage('Introduce un DNI o nombre para filtrar');
                  return
                }
                const results = await searchPatients(patientQuery)
                const match = results.find(p => p.dni === patientQuery.trim() || p.document_number === patientQuery.trim())
                if (match) {
                  setForm({ ...form, patient_id: match.id.toString() })
                } else {
                  setMessage('No se encontró un paciente con ese DNI.');
                }
              }} style={{ marginBottom: 12 }}>
                Filtrar pacientes
              </button>
              <label>
                Paciente *
                <select required value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
                  <option value="">Seleccionar paciente</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>{patient.full_name} — {patient.dni}</option>
                  ))}
                </select>
              </label>
              <label>Médico<input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} /></label>
              <label>Motivo<input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
              <label>Síntomas<input value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} /></label>
              <label>Diagnóstico<input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></label>
              <label>Tratamiento<input value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })} /></label>
              <label>Receta<input value={form.prescription} onChange={e => setForm({ ...form, prescription: e.target.value })} /></label>
              <div className="button-row">
                <button type="submit">Guardar consulta</button>
                <button type="button" className="secondary" onClick={() => { setShowForm(false); setMessage('') }}>
                  Cancelar
                </button>
              </div>
            </form>
            {message && <div className="form-message">{message}</div>}
          </div>
        )}
      </div>
      <div className="card">
        <h2>Consultas recientes</h2>
        <p className="collection-total">Número total de elementos: {consultations.length}</p>
        {consultations.length === 0 ? (
          <p className="muted">No hay consultas registradas.</p>
        ) : (
          <div className="items-grid">
            {consultations.map(item => (
              <div key={item.id} className="item-card">
                <h3>{item.reason}</h3>
                <p>ID: {item.id}</p>
                <p>{item.diagnosis || 'Sin diagnóstico'}</p>
                <p>{item.doctor_name}</p>
                <span className="meta">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Locations() {
  const [items, setItems] = useState([])
  const [selectedArea, setSelectedArea] = useState(null)
  const [detail, setDetail] = useState(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [showNewAreaForm, setShowNewAreaForm] = useState(false)
  const [newAreaName, setNewAreaName] = useState('')
  const [newAreaDescription, setNewAreaDescription] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const { user } = useAuth()
  const canEdit = ['admin', 'tenant_admin'].includes(user?.role)

  async function load() {
    const res = await apiFetch('/locations')
    if (res.ok) setItems(await res.json() || [])
  }

  async function loadDetail(id) {
    setIsLoadingDetail(true)
    const res = await apiFetch(`/locations/${id}`)
    if (res.ok) setDetail(await res.json())
    setIsLoadingDetail(false)
  }

  async function submitNewArea(e) {
    e.preventDefault()
    if (!newAreaName.trim()) {
      setErrorMessage('El nombre del área es requerido.')
      return
    }
    setIsSaving(true)
    setErrorMessage('')
    const res = await apiFetch('/locations', {
      method: 'POST',
      body: JSON.stringify({ name: newAreaName.trim(), description: newAreaDescription.trim() })
    })
    const data = await res.json()
    if (res.ok) {
      setNewAreaName('')
      setNewAreaDescription('')
      setShowNewAreaForm(false)
      await load()
      if (data.id) setSelectedArea(data.id)
    } else {
      setErrorMessage(data.message || 'No se pudo crear el área.')
    }
    setIsSaving(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selectedArea) {
      loadDetail(selectedArea)
    }
  }, [selectedArea])

  return (
    <div className="location-page">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h2>Áreas del hospital</h2>
            <p className="muted">Selecciona un área para ver los datos operativos. Solo administración puede editar nombres y descripciones.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {canEdit && (
              <button type="button" className="button secondary" onClick={() => setShowNewAreaForm(!showNewAreaForm)}>
                {showNewAreaForm ? 'Cancelar' : 'Agregar área'}
              </button>
            )}
            {canEdit && <span className="note">✏️ Editar habilitado</span>}
          </div>
        </div>

        {showNewAreaForm && (
          <div className="card form-card">
            <h3>Crear nueva área</h3>
            <form onSubmit={submitNewArea}>
              <label>
                Nombre del área
                <input value={newAreaName} onChange={e => setNewAreaName(e.target.value)} placeholder="Nombre del área" />
              </label>
              <label>
                Descripción
                <textarea value={newAreaDescription} onChange={e => setNewAreaDescription(e.target.value)} placeholder="Breve descripción de la área" />
              </label>
              {errorMessage && <div className="error">{errorMessage}</div>}
              <div className="button-row">
                <button type="submit" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Crear área'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="items-grid">
          {items.map(area => (
            <button
              key={area.id}
              type="button"
              className={`area-card ${selectedArea === area.id ? 'selected' : ''}`}
              onClick={() => setSelectedArea(area.id)}
            >
              <div className="area-card-header">
                <h3>{area.name}</h3>
                {canEdit && <span className="area-edit-icon" aria-label="Editar área">✏️</span>}
              </div>
              <p>{area.description || 'Área operativa sin descripción'}</p>
              <div className="area-metrics">
                <span>{area.device_count ?? 0} dispositivos</span>
                <span>{area.active_alerts ?? 0} alertas activas</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedArea && (
        <div className="card area-detail-card">
          <div className="card-header-row">
            <h2>Detalle de área</h2>
            <button type="button" className="button secondary" onClick={() => setSelectedArea(null)}>Cerrar</button>
          </div>
          {isLoadingDetail ? (
            <p>Cargando detalles...</p>
          ) : detail ? (
            <div className="area-detail-content">
              <div className="area-detail-meta">
                <h3>{detail.name}</h3>
                <p>{detail.description || 'Descripción no registrada'}</p>
                <div className="area-detail-row">
                  <span><strong>Usuarios en área:</strong> {detail.user_count != null ? detail.user_count : '—'}</span>
                  <span><strong>Ubicación en hospital:</strong> {detail.hospital_position || 'Pendiente'}</span>
                </div>
                <div className="area-detail-row">
                  <span><strong>Dispositivos:</strong> {detail.device_count ?? 0}</span>
                  <span><strong>Alertas activas:</strong> {detail.active_alerts ?? 0}</span>
                </div>
                <div className="area-detail-row">
                  <span><strong>Alertas totales:</strong> {detail.total_alerts ?? 0}</span>
                  <span><strong>Creado:</strong> {detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</span>
                </div>
              </div>
              {canEdit ? (
                <div className="area-detail-edit-hint">
                  Puedes editar el nombre y la descripción del área desde el botón de administración.
                </div>
              ) : (
                <div className="area-detail-edit-hint muted">
                  Solo los administradores pueden editar esta área.
                </div>
              )}
            </div>
          ) : (
            <p>Selecciona un área para ver su detalle.</p>
          )}
        </div>
      )}
    </div>
  )
}

export function Devices() {
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const { user } = useAuth()

  async function load() {
    const [res1, res2] = await Promise.all([apiFetch('/devices'), apiFetch('/locations')])
    if (res1.ok) setItems(await res1.json() || [])
    if (res2.ok) setLocations(await res2.json() || [])
  }

  useEffect(() => { load() }, [])

  return (
    <div className="card">
      <h2>Dispositivos</h2>
      <p className="muted">Vista operativa: solo lectura. Use 'Dispositivos / Acciones' para ver actividad por IP y acciones realizadas.</p>
      <div className="items-grid">
        {items.map(i => (
          <div key={i.id} className="item-card">
            <h3>{i.name}</h3>
            <p>Tipo: {i.type || '—'}</p>
            <p>Ubicación: {locations.find(l => l.id === i.location_id)?.name || '—'}</p>
            <span className="meta">Estado: {i.status || 'Activo'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DeviceActions() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [perPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [filterAction, setFilterAction] = useState('')
  const [filterIP, setFilterIP] = useState('')
  const [filterUser, setFilterUser] = useState('')

  async function load() {
    const q = new URLSearchParams()
    q.set('page', page)
    q.set('per_page', perPage)
    if (filterAction) q.set('action_type', filterAction)
    if (filterIP) q.set('ip', filterIP)
    if (filterUser) q.set('user_id', filterUser)
    const res = await apiFetch('/device_actions?' + q.toString())
    if (res.ok) {
      const j = await res.json()
      setItems(j.items || [])
      setTotal(j.total || 0)
    }
  }

  useEffect(() => { load() }, [page, filterAction, filterIP, filterUser])

  function exportCSV() {
    const q = new URLSearchParams()
    if (filterAction) q.set('action_type', filterAction)
    if (filterIP) q.set('ip', filterIP)
    if (filterUser) q.set('user_id', filterUser)
    window.open('/api/device_actions/export?' + q.toString(), '_blank')
  }

  return (
    <div className="card">
      <h2>Acciones por Dispositivo / Sesiones</h2>
      <div className="collection-toolbar">
        <label>Acción<input value={filterAction} onChange={e => setFilterAction(e.target.value)} placeholder="create|download|delete" /></label>
        <label>IP<input value={filterIP} onChange={e => setFilterIP(e.target.value)} placeholder="127.0.0.1" /></label>
        <label>User ID<input value={filterUser} onChange={e => setFilterUser(e.target.value)} placeholder="user id" /></label>
        <div className="button-row"><button className="button" onClick={() => { setPage(1); load() }}>Filtrar</button><button className="button secondary" onClick={exportCSV}>Export CSV</button></div>
      </div>

      <div className="items-grid">
        {items.map(it => (
          <div key={it.id} className="item-card">
            <h3>{it.action_type}</h3>
            <p><strong>IP:</strong> {it.ip_address} · <strong>User:</strong> {it.username || it.user_id}</p>
            <p>{it.details}</p>
            <span className="meta">{it.created_at ? new Date(it.created_at).toLocaleString() : '—'}</span>
          </div>
        ))}
      </div>

      <div className="pagination-footer">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span>Página {page} · Total {total}</span>
        <button disabled={page * perPage >= total} onClick={() => setPage(page + 1)}>Siguiente</button>
      </div>
    </div>
  )
}

export function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [patientQuery, setPatientQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patient_id: '', doctor_name: 'Dra. Mendoza', specialty: 'Cardiología', appointment_date: '', notes: '' })
  const [message, setMessage] = useState('')

  async function loadAppointments() {
    const res = await apiFetch('/appointments')
    if (res.ok) setAppointments(await res.json() || [])
  }

  async function searchPatients(query = '') {
    const res = await apiFetch(`/patients?q=${encodeURIComponent(query)}`)
    if (res.ok) setPatients(await res.json() || [])
  }

  useEffect(() => {
    loadAppointments()
    searchPatients()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    // Prevent scheduling in the past
    if (form.appointment_date) {
      const selected = new Date(form.appointment_date)
      const now = new Date()
      if (selected < now) {
        setMessage('No se puede programar una cita en una fecha anterior a la actual')
        return
      }
    }
    const res = await apiFetch('/appointments', { method: 'POST', body: JSON.stringify(form) })
    if (res.ok) {
      setMessage('Cita creada')
      setForm({ patient_id: '', doctor_name: 'Dra. Mendoza', specialty: 'Cardiología', appointment_date: '', notes: '' })
      setShowForm(false)
      loadAppointments()
    } else {
      const json = await res.json().catch(() => ({}))
      setMessage(json.message || 'Error al crear cita')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header-row">
          <h2>Programar cita</h2>
          {!showForm && (
            <button type="button" className="button add-button" onClick={() => { setShowForm(true); setMessage('') }}>
              Agregar
            </button>
          )}
        </div>
        {showForm && (
          <div className="form-card">
            <form onSubmit={submit}>
              <label>
                Buscar DNI del paciente
                <input value={patientQuery} onChange={e => setPatientQuery(e.target.value)} placeholder="DNI o nombre" />
              </label>
              <button type="button" onClick={() => { if (!patientQuery || !patientQuery.trim()) { setMessage('Introduce un DNI o nombre para filtrar'); return } searchPatients(patientQuery) }} style={{ marginBottom: 12 }}>
                Filtrar pacientes
              </button>
              <label>
                Paciente *
                <select required value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
                  <option value="">Seleccionar paciente</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>{patient.full_name} — {patient.dni}</option>
                  ))}
                </select>
              </label>
              <label>Médico<input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} /></label>
              <label>Especialidad
                <select value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })}>
                  <option value="">Seleccionar especialidad</option>
                  <option>Cardiología</option>
                  <option>Pediatría</option>
                  <option>Medicina General</option>
                  <option>Dermatología</option>
                  <option>Ginecología</option>
                </select>
              </label>
              <label>Fecha y Hora *
                <input required type="datetime-local" min={new Date().toISOString().slice(0,16)} value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} />
              </label>
              <label>Notas<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
              <div className="button-row">
                <button type="submit">Guardar cita</button>
                <button type="button" className="secondary" onClick={() => { setShowForm(false); setMessage('') }}>
                  Cancelar
                </button>
              </div>
            </form>
            {message && <div className="form-message">{message}</div>}
          </div>
        )}
      </div>
      <div className="card">
        <h2>Citas programadas</h2>
        <p className="collection-total">Número total de elementos: {appointments.length}</p>
        {appointments.length === 0 ? (
          <p className="muted">No hay citas programadas.</p>
        ) : (
          <div className="items-grid">
            {appointments.map(item => (
              <div key={item.id} className="item-card">
                <h3>{item.specialty}</h3>
                <p>ID: {item.id}</p>
                <p>{item.doctor_name}</p>
                <p>{item.appointment_date}</p>
                <p>{item.notes || 'Sin notas'}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Documents() {
  const [documents, setDocuments] = useState([])
  const [patients, setPatients] = useState([])
  const [patientQuery, setPatientQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ patient_id: '', document_type: 'result', file_name: '', description: '' })
  const [selectedFile, setSelectedFile] = useState(null)
  const [message, setMessage] = useState('')

  async function loadDocuments() {
    const res = await apiFetch('/documents')
    if (res.ok) setDocuments(await res.json() || [])
  }

  async function searchPatients(query = '') {
    const res = await apiFetch(`/patients?q=${encodeURIComponent(query)}`)
    if (res.ok) setPatients(await res.json() || [])
  }

  useEffect(() => {
    loadDocuments()
    searchPatients()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setMessage('')

    if (!selectedFile) {
      setMessage('Selecciona un archivo PDF antes de enviar')
      return
    }

    const formData = new FormData()
    formData.append('patient_id', form.patient_id)
    formData.append('document_type', form.document_type)
    formData.append('description', form.description)
    formData.append('file_name', form.file_name || selectedFile.name)
    formData.append('file', selectedFile)

    const res = await apiFetch('/documents', { method: 'POST', body: formData })
    if (res.ok) {
      setMessage('Documento registrado')
      setForm({ patient_id: '', document_type: 'result', file_name: '', description: '' })
      setSelectedFile(null)
      setShowForm(false)
      loadDocuments()
    } else {
      const json = await res.json().catch(() => ({}))
      setMessage(json.message || 'Error al registrar documento')
    }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header-row">
          <h2>Subir documento clínico</h2>
          {!showForm && (
            <button type="button" className="button add-button" onClick={() => { setShowForm(true); setMessage('') }}>
              Agregar
            </button>
          )}
        </div>
        {showForm && (
          <div className="form-card">
            <form onSubmit={submit}>
              <label>
                Buscar DNI del paciente
                <input value={patientQuery} onChange={e => setPatientQuery(e.target.value)} placeholder="DNI o nombre" />
              </label>
              <button type="button" onClick={() => { if (!patientQuery || !patientQuery.trim()) { setMessage('Introduce un DNI o nombre para filtrar'); return } searchPatients(patientQuery) }} style={{ marginBottom: 12 }}>
                Filtrar pacientes
              </button>
              <label>
                Paciente *
                <select required value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
                  <option value="">Seleccionar paciente</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>{patient.full_name} — {patient.dni}</option>
                  ))}
                </select>
              </label>
              <label>Tipo de documento
                <select value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}>
                  <option value="">Seleccionar tipo de documento</option>
                  <option value="result">Resultado</option>
                  <option value="report">Informe</option>
                  <option value="prescription">Prescripción</option>
                  <option value="other">Otro</option>
                </select>
              </label>
              <label>Archivo PDF *
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) {
                      setSelectedFile(null)
                      setForm({ ...form, file_name: '' })
                      return
                    }
                    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                      setMessage('Solo se permiten archivos PDF')
                      e.target.value = null
                      return
                    }
                    setSelectedFile(file)
                    setForm({ ...form, file_name: file.name })
                  }}
                />
              </label>
              <label>Nombre del archivo *
                <input required value={form.file_name} onChange={e => setForm({ ...form, file_name: e.target.value })} />
              </label>
              <label>Descripción<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
              <div className="button-row">
                <button type="submit">Guardar documento</button>
                <button type="button" className="secondary" onClick={() => { setShowForm(false); setMessage('') }}>
                  Cancelar
                </button>
              </div>
            </form>
            {message && <div className="form-message">{message}</div>}
          </div>
        )}
      </div>
      <div className="card">
        <h2>Documentos cargados</h2>
        <p className="collection-total">Número total de elementos: {documents.length}</p>
        {documents.length === 0 ? (
          <p className="muted">No hay documentos cargados.</p>
        ) : (
          <div className="items-grid">
            {documents.map(item => (
              <div key={item.id} className="item-card">
                <h3>{item.file_name}</h3>
                <p>ID: {item.id}</p>
                <p>{item.document_type}</p>
                <p>{item.description || 'Sin descripción'}</p>
                <span className="meta">Estado: {item.status || 'Activo'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Reports() {
  const [data, setData] = useState(null)
  const [incidents, setIncidents] = useState([])
  const [newIncident, setNewIncident] = useState({ incident_type: '', description: '' })

  useEffect(() => {
    apiFetch('/reports').then(async res => {
      if (res.ok) setData(await res.json())
    })
    apiFetch('/incidents').then(async res => { if (res.ok) setIncidents(await res.json()) })
  }, [])

  return (
    <div className="card">
      <h2>Reportes operativos</h2>
      {data ? (
        <div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value">{data.summary?.patients ?? 0}</span>
              <span className="stat-label">Pacientes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data.summary?.consultations ?? 0}</span>
              <span className="stat-label">Consultas</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data.summary?.appointments ?? 0}</span>
              <span className="stat-label">Citas</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data.summary?.documents ?? 0}</span>
              <span className="stat-label">Documentos</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{data.summary?.active_alerts ?? 0}</span>
              <span className="stat-label">Alertas activas</span>
            </div>
          </div>
          <h3>Consultas recientes</h3>
          <div className="items-grid">
            {(data.recent_consultations || []).map(item => (
              <div key={item.id} className="item-card">
                <h3>{item.reason}</h3>
                <p>{item.diagnosis || 'Sin diagnóstico'}</p>
                <span className="meta">{item.created_at ? new Date(item.created_at).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
          <h3 style={{ marginTop: 18 }}>Incidencias reportadas</h3>
          <div style={{ marginBottom: 12 }}>
            <label>Tipo de incidencia<input value={newIncident.incident_type} onChange={e => setNewIncident({ ...newIncident, incident_type: e.target.value })} /></label>
            <label>Descripción<input value={newIncident.description} onChange={e => setNewIncident({ ...newIncident, description: e.target.value })} /></label>
            <div className="button-row"><button className="button" onClick={async () => {
              if (!newIncident.incident_type) return alert('Tipo requerido')
              const res = await apiFetch('/incidents', { method: 'POST', body: JSON.stringify(newIncident) })
              if (res.ok) { setNewIncident({ incident_type: '', description: '' }); const list = await (await apiFetch('/incidents')).json(); setIncidents(list) }
            }}>Reportar incidencia</button></div>
          </div>

          <div className="items-grid">
            {incidents.map(i => (
              <div key={i.id} className="item-card">
                <h3>{i.incident_type}</h3>
                <p>{i.description}</p>
                <span className="meta">Estado: {i.status} · {i.created_at ? new Date(i.created_at).toLocaleString() : '—'}</span>
                <div style={{ marginTop: 8 }}>
                  <select value={i.status} onChange={async (e) => { await apiFetch('/incidents', { method: 'PUT', body: JSON.stringify({ id: i.id, status: e.target.value }) }); const list = await (await apiFetch('/incidents')).json(); setIncidents(list) }}>
                    <option value="open">Por atender</option>
                    <option value="in_progress">En proceso</option>
                    <option value="closed">Atendido</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>Cargando reportes...</p>
      )}
    </div>
  )
}

export function Dashboard() {
  const [reports, setReports] = useState(null)
  const [series, setSeries] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [areas, setAreas] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('all')
  const [days, setDays] = useState(30)

  useEffect(() => {
    apiFetch('/reports').then(async res => {
      if (res.ok) setReports(await res.json())
    })
    apiFetch(`/reports/series?days=${days}`).then(async res => {
      if (res.ok) setSeries(await res.json())
    })
    apiFetch('/metrics').then(async res => {
      if (res.ok) setMetrics(await res.json())
    })
    apiFetch('/dashboard/areas').then(async res => {
      if (res.ok) setAreas(await res.json())
    })
  }, [days])

  const filteredAreas = selectedLocation === 'all' ? areas : areas.filter(a => String(a.id) === String(selectedLocation))
  const totalDevices = filteredAreas.reduce((sum, a) => sum + (a.device_count || 0), 0)
  const totalAlerts = filteredAreas.reduce((sum, a) => sum + (a.total_alerts || 0), 0)

  return (
    <div className="card">
      <h2>Dashboard Gerencial</h2>
      {!reports || !metrics ? (
        <p>Cargando métricas...</p>
      ) : (
        <div>
          <div className="filter-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <label>
              Día(s)
              <select value={days} onChange={e => setDays(Number(e.target.value))}>
                <option value={7}>Últimos 7 días</option>
                <option value={14}>Últimos 14 días</option>
                <option value={30}>Últimos 30 días</option>
              </select>
            </label>
            <label>
              Área
              <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)}>
                <option value="all">Todas las áreas</option>
                {areas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}
              </select>
            </label>
          </div>

          <div className="stats-grid">
            <div className="stat-card"><span className="stat-value">{reports.summary?.patients ?? 0}</span><span className="stat-label">Pacientes</span></div>
            <div className="stat-card"><span className="stat-value">{reports.summary?.consultations ?? 0}</span><span className="stat-label">Consultas</span></div>
            <div className="stat-card"><span className="stat-value">{metrics.active_users ?? 0}</span><span className="stat-label">Usuarios activos</span></div>
            <div className="stat-card"><span className="stat-value">{Math.round(metrics.avg_session_seconds)}</span><span className="stat-label">Duración media (s)</span></div>
            <div className="stat-card"><span className="stat-value">{Math.round(metrics.session_duration_prediction_seconds || 0)}</span><span className="stat-label">Predicción próxima sesión (s)</span></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
            <div className="card chart-card" style={{ minHeight: 320 }}>
              <h3>Tendencia de pacientes / consultas</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={series} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" tickFormatter={day => new Date(day).toLocaleDateString()} />
                  <YAxis />
                  <Tooltip labelFormatter={label => new Date(label).toLocaleDateString()} />
                  <Legend />
                  <Line type="monotone" dataKey="patients" stroke="#1f77b4" name="Pacientes" />
                  <Line type="monotone" dataKey="consultations" stroke="#ff7f0e" name="Consultas" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card chart-card" style={{ minHeight: 320 }}>
              <h3>Dispositivos y alertas por área</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={filteredAreas} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="device_count" fill="#82ca9d" name="Dispositivos" />
                  <Bar dataKey="active_alerts" fill="#ff6961" name="Alertas activas" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3>Puntos clave de la hospitalización</h3>
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-value">{totalDevices}</span><span className="stat-label">Dispositivos en área</span></div>
              <div className="stat-card"><span className="stat-value">{totalAlerts}</span><span className="stat-label">Alertas en área</span></div>
              <div className="stat-card"><span className="stat-value">{filteredAreas.length}</span><span className="stat-label">Áreas seleccionadas</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function Users() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  async function load() {
    setLoading(true)
    const [usersRes, locationsRes] = await Promise.all([apiFetch('/users'), apiFetch('/locations')])
    if (usersRes.ok) setUsers(await usersRes.json() || [])
    if (locationsRes.ok) setLocations(await locationsRes.json() || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function changeRole(u, newRole) {
    const res = await apiFetch(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ role: newRole, location_id: u.location_id }) })
    if (res.ok) load()
  }

  async function changeLocation(u, newLocationId) {
    const res = await apiFetch(`/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ location_id: newLocationId }) })
    if (res.ok) load()
  }

  const supportsLocationAssignment = false

  async function resetPassword(u) {
    const pw = prompt('Nueva contraseña para ' + u.username)
    if (!pw) return
    const res = await apiFetch(`/users/${u.id}/reset_password`, { method: 'POST', body: JSON.stringify({ new_password: pw }) })
    if (res.ok) alert('Contraseña actualizada')
  }

  return (
    <div className="card">
      <h2>Gestión de usuarios</h2>
      {loading ? <p>Cargando...</p> : (
        <div>
          <table className="table">
            <thead><tr><th>ID</th><th>Usuario</th><th>Rol</th><th>Área</th><th>Creado</th><th>Acciones</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>
                    <select value={u.role} onChange={e => changeRole(u, e.target.value)}>
                      <option value="viewer">viewer</option>
                      <option value="operator">operator</option>
                      <option value="tenant_admin">tenant_admin</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    {supportsLocationAssignment ? (
                      <select value={u.location_id || ''} onChange={e => changeLocation(u, e.target.value || null)}>
                        <option value="">Sin área</option>
                        {locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span>Sin asignación</span>
                    )}
                  </td>
                  <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <button className="button" onClick={() => resetPassword(u)} style={{ marginLeft: 8 }}>Reset PW</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [oldPw, setOldPw] = useState('')
  const [newPw, setNewPw] = useState('')

  useEffect(() => {
    apiFetch('/profile').then(async res => {
      if (res.ok) setProfile(await res.json())
    })
  }, [])

  async function changePw(e) {
    e.preventDefault()
    if (!oldPw || !newPw) return alert('Ingresa ambas contraseñas')
    const res = await apiFetch('/profile/change_password', { method: 'POST', body: JSON.stringify({ old_password: oldPw, new_password: newPw }) })
    const j = await res.json().catch(() => ({}))
    if (res.ok) { alert('Contraseña cambiada'); setOldPw(''); setNewPw('') } else { alert(j.message || 'Error') }
  }

  return (
    <div className="card">
      <h2>Mi Perfil</h2>
      {!profile ? <p>Cargando...</p> : (
        <div>
          <p><strong>Usuario:</strong> {profile.username}</p>
          <p><strong>Rol:</strong> {profile.role}</p>
          <p><strong>Creado:</strong> {profile.created_at ? new Date(profile.created_at).toLocaleString() : '—'}</p>
          <div className="stats-grid" style={{ marginTop: 12 }}>
            <div className="stat-card"><span className="stat-value">{profile.counts?.patients ?? 0}</span><span className="stat-label">Pacientes</span></div>
            <div className="stat-card"><span className="stat-value">{profile.counts?.consultations ?? 0}</span><span className="stat-label">Consultas</span></div>
            <div className="stat-card"><span className="stat-value">{profile.counts?.appointments ?? 0}</span><span className="stat-label">Citas</span></div>
            <div className="stat-card"><span className="stat-value">{profile.counts?.documents ?? 0}</span><span className="stat-label">Documentos</span></div>
          </div>

          <h3 style={{ marginTop: 16 }}>Cambiar contraseña</h3>
          <form onSubmit={changePw} className="form-grid">
            <label>Contraseña actual<input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} /></label>
            <label>Nueva contraseña<input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></label>
            <div className="button-row"><button type="submit">Cambiar contraseña</button></div>
          </form>
        </div>
      )}
    </div>
  )
}