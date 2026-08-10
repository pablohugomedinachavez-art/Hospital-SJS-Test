import React, { useEffect, useState } from 'react'
import { api } from './api'; // o '../api' según la ubicación del archivo
import { apiFetch } from './api';
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

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      // client-side uniqueness checks for document number, phone, email
      const existingDocument = patients.find(p => p.document_number === form.document_number && form.document_number.trim() !== '')
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
        dni: form.document_type === 'dni' ? form.document_number : ''
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
    const res = await apiFetch('/documents', { method: 'POST', body: JSON.stringify(form) })
    if (res.ok) {
      setMessage('Documento registrado')
      setForm({ patient_id: '', document_type: 'result', file_name: '', description: '' })
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
              <label>Nombre del archivo *<input required value={form.file_name} onChange={e => setForm({ ...form, file_name: e.target.value })} /></label>
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

  useEffect(() => {
    apiFetch('/reports').then(async res => {
      if (res.ok) setData(await res.json())
    })
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
        </div>
      ) : (
        <p>Cargando reportes...</p>
      )}
    </div>
  )
}