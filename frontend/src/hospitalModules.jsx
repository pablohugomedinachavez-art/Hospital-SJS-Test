import React, { useEffect, useState } from 'react'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { api } from './api';
import { apiFetch } from './api';
import { useAuth } from './AuthContext'

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
  const [documentError, setDocumentError] = useState('')
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

  const handleSwitchToCreate = () => {
    setView('create')
    setMessage('')
    setDocumentError('')
    load('')
  }

  const handleDocumentChange = (value, docType = form.document_type) => {
    const cleanValue = docType === 'dni' 
      ? value.replace(/\D/g, '') 
      : value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
      
    const maxLength = docType === 'dni' ? 8 : 12
    const docNumber = cleanValue.slice(0, maxLength)

    setForm(prev => ({ ...prev, document_number: docNumber }))

    if (docNumber.trim() !== '') {
      const exists = patients.some(p => {
        const dniStr = p.dni ? String(p.dni).trim() : ''
        const docStr = p.document_number ? String(p.document_number).trim() : ''
        return dniStr === docNumber || docStr === docNumber
      })

      if (exists) {
        setDocumentError(`⚠️ El ${docType.toUpperCase()} ${docNumber} ya se encuentra registrado.`)
      } else {
        setDocumentError('')
      }
    } else {
      setDocumentError('')
    }
  }

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
    if (documentError) {
      setMessage('Corrige los errores en el formulario antes de continuar.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      const docNumStr = form.document_number.trim()
      const existingDocument = patients.find(p => {
        const dniStr = p.dni ? String(p.dni).trim() : ''
        const docStr = p.document_number ? String(p.document_number).trim() : ''
        return (dniStr === docNumStr || docStr === docNumStr) && docNumStr !== ''
      })

      if (existingDocument) {
        setMessage('El número de documento ya existe para otro paciente')
        setLoading(false)
        return
      }

      const phoneValue = `${form.phone_country}${form.phone_number}`
      const existingPhone = patients.find(p => String(p.phone).trim() === phoneValue && form.phone_number.trim() !== '')
      if (existingPhone) {
        setMessage('El teléfono ya está registrado para otro paciente')
        setLoading(false)
        return
      }

      const existingEmail = patients.find(p => String(p.email).toLowerCase().trim() === form.email.toLowerCase().trim() && form.email.trim() !== '')
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
        setDocumentError('')
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
            <button type="button" className="button secondary" onClick={() => { setView('list'); setMessage(''); setDocumentError('') }}>
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
                  <select 
                    value={form.document_type} 
                    onChange={e => {
                      const newType = e.target.value
                      setForm(prev => ({ ...prev, document_type: newType, document_number: '' }))
                      setDocumentError('')
                    }}
                  >
                    <option value="dni">DNI</option>
                    <option value="ce">CARNET DE EXTRANJERÍA</option>
                  </select>
                </label>
                <label>
                  Número de documento
                  <input
                    required
                    value={form.document_number}
                    onChange={e => handleDocumentChange(e.target.value)}
                    placeholder={form.document_type === 'dni' ? '8 dígitos' : 'Hasta 12 caracteres'}
                  />
                  {documentError && (
                    <span style={{ color: '#d9534f', fontSize: '0.85rem', marginTop: '4px', display: 'block', fontWeight: 'bold' }}>
                      {documentError}
                    </span>
                  )}
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
                <button type="submit" disabled={loading || Boolean(documentError)}>
                  {loading ? 'Guardando...' : 'Registrar paciente'}
                </button>
                <button type="button" className="secondary" onClick={() => { setView('list'); setMessage(''); setDocumentError('') }}>
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
                <button type="button" className="button secondary" onClick={handleSwitchToCreate}>
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
                  <button type="button" className="button" onClick={handleSwitchToCreate}>
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
                        <p>DNI / Documento: {patient.dni || patient.document_number}</p>
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
  const [query, setQuery] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  const initialFormState = {
    patient_id: '',
    doctor_name: 'Dr. Demo',
    reason: '',
    symptoms: '',
    weight_kg: '',
    height_cm: '',
    blood_pressure: '',
    bmi: '',
    abdominal_perimeter_cm: '',
    diagnosis: '',
    treatment: '',
    prescription: ''
  }

  const [form, setForm] = useState(initialFormState)

  const showNotification = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 5000)
  }

  async function loadConsultations(q = '') {
    setLoading(true)
    try {
      const res = await apiFetch(`/consultations?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setConsultations(data || [])
      } else {
        showNotification('Error al cargar la lista de consultas.', 'error')
      }
    } catch (err) {
      showNotification('Error de red al cargar consultas.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function searchPatients(q = '') {
    try {
      const res = await apiFetch(`/patients?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = (await res.json()) || []
        setPatients(data)
        return data
      }
    } catch (err) {
      console.error('Error al buscar pacientes:', err)
    }
    return []
  }

  useEffect(() => {
    loadConsultations()
    searchPatients()
  }, [])

  const calculateBMI = (weight, height) => {
    const w = parseFloat(weight)
    const h = parseFloat(height)
    if (w > 0 && h > 0) {
      const heightInMeters = h / 100
      return (w / (heightInMeters * heightInMeters)).toFixed(2)
    }
    return ''
  }

  const handleTriageChange = (field, value) => {
    const updatedForm = { ...form, [field]: value }
    if (field === 'weight_kg' || field === 'height_cm') {
      const w = field === 'weight_kg' ? value : form.weight_kg
      const h = field === 'height_cm' ? value : form.height_cm
      updatedForm.bmi = calculateBMI(w, h)
    }
    setForm(updatedForm)
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.patient_id) {
      showNotification('Debes seleccionar un paciente antes de guardar.', 'error')
      return
    }

    setIsSubmitting(true)
    setMessage({ text: '', type: '' })

    try {
      const res = await apiFetch('/consultations', {
        method: 'POST',
        body: JSON.stringify(form)
      })

      if (res.ok) {
        showNotification('Consulta médica registrada con éxito.', 'success')
        setForm(initialFormState)
        setShowForm(false)
        await loadConsultations(query)
      } else {
        const json = await res.json().catch(() => ({}))
        showNotification(json.message || 'Error al registrar la consulta.', 'error')
      }
    } catch (err) {
      showNotification('Error de conexión con el servidor.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* NOTIFICACIONES TOAST */}
      {message.text && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '10px',
          marginBottom: '20px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: message.type === 'error' ? '#FEF2F2' : '#F0FDF4',
          color: message.type === 'error' ? '#991B1B' : '#166534',
          border: `1px solid ${message.type === 'error' ? '#FCA5A5' : '#86EFAC'}`
        }}>
          <span>{message.type === 'error' ? '⚠️' : '✅'}</span>
          <span>{message.text}</span>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <div style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        marginBottom: '24px',
        border: '1px solid #E5E7EB'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#111827', fontWeight: '700' }}>
              {showForm ? '📋 Nueva Consulta Médica y Triaje' : '🩺 Consultas Médicas'}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '0.9rem' }}>
              {showForm
                ? 'Ingresa los datos del paciente, medidas de triaje y la receta médica.'
                : 'Gestiona los expedientes clínicos y consultas agendadas.'}
            </p>
          </div>

          <div>
            {!showForm ? (
              <button
                type="button"
                onClick={() => { setShowForm(true); setMessage({ text: '', type: '' }) }}
                style={{
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                }}
              >
                + Nueva Consulta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setShowForm(false); setMessage({ text: '', type: '' }) }}
                style={{
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  border: '1px solid #D1D5DB',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ← Volver al Historial
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        {!showForm && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadConsultations(query)}
              placeholder="🔍 Buscar por nombre, DNI, médico o diagnóstico..."
              style={{
                flex: 1,
                minWidth: '280px',
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #D1D5DB',
                outline: 'none',
                fontSize: '0.95rem'
              }}
            />
            <button
              type="button"
              onClick={() => loadConsultations(query)}
              style={{
                backgroundColor: '#1E293B',
                color: '#FFFFFF',
                padding: '10px 20px',
                borderRadius: '10px',
                border: 'none',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Buscar
            </button>
          </div>
        )}
      </div>

      {/* FORMULARIO DE REGISTRO */}
      {showForm && (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* SECCIÓN 1: DATOS GENERALES */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1F2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              👤 Datos del Paciente y Atención
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Filtrar Lista por DNI
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={patientQuery}
                    onChange={e => setPatientQuery(e.target.value)}
                    placeholder="Escribe DNI..."
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!patientQuery.trim()) return
                      const results = await searchPatients(patientQuery)
                      const match = results.find(p => String(p.dni || p.document_number).trim() === patientQuery.trim())
                      if (match) {
                        setForm(prev => ({ ...prev, patient_id: match.id.toString() }))
                        showNotification(`Paciente seleccionado: ${match.full_name}`, 'success')
                      }
                    }}
                    style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', cursor: 'pointer', fontWeight: '500' }}
                  >
                    Filtrar
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Paciente Seleccionado *
                </label>
                <select
                  required
                  value={form.patient_id}
                  onChange={e => setForm({ ...form, patient_id: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF' }}
                >
                  <option value="">-- Selecciona un paciente --</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} — DNI: {p.dni || p.document_number || 'N/A'}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Médico Tratante
                </label>
                <input
                  value={form.doctor_name}
                  onChange={e => setForm({ ...form, doctor_name: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Motivo de Consulta
                </label>
                <input
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ej. Chequeo de rutina / Dolor de cabeza"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: TRIAJE Y SIGNOS VITALES */}
          <div style={{
            backgroundColor: '#F8FAFC',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid #E2E8F0'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📊 Triaje y Signos Vitales
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Peso (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.weight_kg}
                  onChange={e => handleTriageChange('weight_kg', e.target.value)}
                  placeholder="70.5"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Talla (cm)</label>
                <input
                  type="number"
                  value={form.height_cm}
                  onChange={e => handleTriageChange('height_cm', e.target.value)}
                  placeholder="170"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>IMC (Autocalculado)</label>
                <input
                  value={form.bmi}
                  readOnly
                  placeholder="0.00"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#E2E8F0', fontWeight: '700', color: '#0F172A' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Presión Arterial</label>
                <input
                  value={form.blood_pressure}
                  onChange={e => setForm({ ...form, blood_pressure: e.target.value })}
                  placeholder="120/80"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>Perímetro Abd. (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.abdominal_perimeter_cm}
                  onChange={e => setForm({ ...form, abdominal_perimeter_cm: e.target.value })}
                  placeholder="85.0"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: DIAGNÓSTICO Y RECETA */}
          <div style={{
            backgroundColor: '#FFFFFF',
            padding: '24px',
            borderRadius: '16px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#1F2937', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🩺 Diagnóstico y Tratamiento
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Diagnóstico Médico</label>
                <input
                  value={form.diagnosis}
                  onChange={e => setForm({ ...form, diagnosis: e.target.value })}
                  placeholder="Escribe el diagnóstico del paciente..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Plan de Tratamiento</label>
                <input
                  value={form.treatment}
                  onChange={e => setForm({ ...form, treatment: e.target.value })}
                  placeholder="Indicaciones médicas generales..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Receta Médica / Prescripción</label>
                <textarea
                  rows={3}
                  value={form.prescription}
                  onChange={e => setForm({ ...form, prescription: e.target.value })}
                  placeholder="Medicamentos, dosis y frecuencia..."
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D1D5DB', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* BOTONES */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid #D1D5DB', backgroundColor: '#FFFFFF', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ padding: '10px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#10B981', color: '#FFFFFF', fontWeight: '600', cursor: 'pointer' }}
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Consulta'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TARJETAS DEL HISTORIAL DE CONSULTAS */}
      {!showForm && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6B7280' }}>Cargando consultas...</div>
          ) : consultations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E5E7EB' }}>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>🔍</p>
              <p style={{ fontWeight: '600', color: '#374151', marginTop: '8px' }}>No hay registros coincidentes</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {consultations.map(item => (
                <div key={item.id} style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '20px',
                  border: '1px solid #E5E7EB',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>{item.reason || 'Consulta General'}</h4>
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: '12px', color: '#4B5563', fontWeight: '600' }}>
                        #{item.id}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.9rem', color: '#374151', margin: '12px 0 4px 0' }}>
                      <strong>Paciente:</strong> {item.patient_name || `ID #${item.patient_id}`}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#6B7280', margin: '0 0 12px 0' }}>
                      <strong>Atendido por:</strong> {item.doctor_name || 'No asignado'}
                    </p>

                    {(item.weight_kg || item.height_cm || item.bmi) && (
                      <div style={{ backgroundColor: '#F8FAFC', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: '#334155', border: '1px solid #E2E8F0' }}>
                        ⚖️ {item.weight_kg ? `${item.weight_kg}kg` : '—'} | 📏 {item.height_cm ? `${item.height_cm}cm` : '—'} | <strong>IMC:</strong> {item.bmi || '—'}
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6', fontSize: '0.75rem', color: '#9CA3AF' }}>
                    📅 {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Fecha no registrada'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
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

const parseBrowser = (ua) => {
  if (!ua) return 'Desconocido'
  if (ua.includes('Edg')) return 'Microsoft Edge'
  if (ua.includes('Chrome')) return 'Google Chrome'
  if (ua.includes('Firefox')) return 'Mozilla Firefox'
  if (ua.includes('Safari')) return 'Apple Safari'
  return 'Navegador Web'
}

export function Devices() {
  const [devices, setDevices] = useState([])
  const [locations, setLocations] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)

  const { user } = useAuth()
  const [clientInfo, setClientInfo] = useState({ ip: 'Obteniendo...', userAgent: navigator.userAgent })

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [message, setMessage] = useState({ text: '', type: '' })

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  async function loadData() {
    try {
      const [devRes, locRes, logsRes] = await Promise.all([
        apiFetch('/devices'),
        apiFetch('/locations'),
        apiFetch('/device_actions')
      ])
      if (devRes.ok) setDevices(await devRes.json() || [])
      if (locRes.ok) setLocations(await locRes.json() || [])
      if (logsRes.ok) {
        const logsData = await logsRes.json()
        setLogs(Array.isArray(logsData) ? logsData : (logsData.items || []))
      }
    } catch (err) {
      showMessage('Error de conexión al cargar datos', 'error')
    }
  }

  useEffect(() => {
    async function initDeviceModule() {
      setLoading(true)
      let fetchedIp = '127.0.0.1'

      try {
        const ipRes = await fetch('https://api.ipify.org?format=json')
        if (ipRes.ok) {
          const ipData = await ipRes.json()
          fetchedIp = ipData.ip || '127.0.0.1'
        }
      } catch (e) {
        console.warn('No se pudo determinar la IP pública:', e)
      }

      setClientInfo({
        ip: fetchedIp,
        userAgent: navigator.userAgent
      })

      await loadData()

      try {
        await apiFetch('/device_actions', {
          method: 'POST',
          body: JSON.stringify({
            action_type: 'READ_DEVICES_MODULE',
            entity_type: 'devices',
            user_id: user?.id || null,
            username: user?.username || 'Anónimo',
            user_role: user?.role || 'Desconocido',
            ip_address: fetchedIp,
            user_agent: navigator.userAgent,
            details: `Consulta al módulo de dispositivos realizada por ${user?.username || 'Usuario'}`
          })
        })
      } catch (err) {
        console.error('Error al registrar log inicial:', err)
      } finally {
        setLoading(false)
      }
    }

    initDeviceModule()
  }, [])

  const filteredDevices = devices.filter(d => {
    const q = searchQuery.toLowerCase()
    const matchesQuery = !q || d.name?.toLowerCase().includes(q) || d.type?.toLowerCase().includes(q) || d.ip_address?.includes(q)
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesQuery && matchesStatus
  })

  return (
    <div className="card">
      {message.text && (
        <div className={`form-message ${message.type === 'error' ? 'error' : ''}`} style={{ marginBottom: 12 }}>
          {message.type === 'success' ? '✅ ' : '⚠️ '}
          {message.text}
        </div>
      )}

      {/* BLOQUE DE AUDITORÍA DE LA SESIÓN */}
      <div style={{ background: '#f8f9fa', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e9ecef' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#495057' }}>🔒 Contexto de Auditoría Detectado:</h4>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.85rem' }}>
          <span><strong>Usuario:</strong> {user?.username || 'Anónimo'} ({user?.role || 'Sin rol'})</span>
          <span><strong>IP Equipo:</strong> <code style={{ background: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>{clientInfo.ip}</code></span>
          <span><strong>Navegador:</strong> {parseBrowser(clientInfo.userAgent)}</span>
        </div>
      </div>

      <div>
        <h2>Auditoría y Gestión de Dispositivos</h2>
        <p className="muted">Consulta de equipos registrados y trazabilidad inmutable de acciones del sistema.</p>
      </div>

      <div className="collection-toolbar" style={{ marginTop: 16, gap: 12 }}>
        <label className="collection-search" style={{ flex: '1 1 200px' }}>
          <span>Buscar dispositivo</span>
          <input
            type="text"
            placeholder="Buscar por nombre, tipo o IP..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </label>
        <label style={{ flex: '0 0 160px' }}>
          <span>Estado</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Todos</option>
            <option value="available">Disponible</option>
            <option value="in_use">En Uso</option>
            <option value="maintenance">Mantenimiento</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p style={{ marginTop: 20 }}>Cargando datos y registrando trazabilidad...</p>
      ) : filteredDevices.length === 0 ? (
        <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>No hay dispositivos registrados que coincidan con la búsqueda.</p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>IP Vinculada</th>
                <th>Navegador Detectado</th>
                <th>Ubicación</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map(d => {
                const locName = locations.find(l => String(l.id) === String(d.location_id))?.name || 'Sin asignación'
                return (
                  <tr key={d.id}>
                    <td>{d.id}</td>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.type || 'N/A'}</td>
                    <td><code>{d.ip_address || '—'}</code></td>
                    <td>{parseBrowser(d.user_agent)}</td>
                    <td>{locName}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* BITÁCORA DE AUDITORÍA RECIENTE */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #e9ecef' }}>
        <h3>Registros de Auditoría Recientes</h3>
        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Acción</th>
                <th>Usuario / Perfil</th>
                <th>IP Origen</th>
                <th>Navegador / Equipo</th>
                <th>Detalles</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center' }}>No existen registros de auditoría almacenados.</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
                    <td><span className="badge">{log.action_type}</span></td>
                    <td>
                      <strong>{log.username || log.user_id || 'Anónimo'}</strong>
                      {log.user_role && <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>{log.user_role}</div>}
                    </td>
                    <td><code>{log.ip_address || 'Sin IP'}</code></td>
                    <td style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.user_agent}>
                      {parseBrowser(log.user_agent)}
                    </td>
                    <td>{log.details || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function DeviceActions() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [total, setTotal] = useState(0)

  const [filterAction, setFilterAction] = useState('')
  const [filterIP, setFilterIP] = useState('')
  const [filterUser, setFilterUser] = useState('')

  async function loadLogs() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      q.set('page', page)
      q.set('per_page', perPage)
      if (filterAction) q.set('action_type', filterAction)
      if (filterIP) q.set('ip', filterIP)
      if (filterUser) q.set('user_id', filterUser)

      const res = await apiFetch('/device_actions?' + q.toString())
      if (res.ok) {
        const data = await res.json()
        const logsList = Array.isArray(data) ? data : (data.items || [])
        setItems(logsList)
        setTotal(data.total || logsList.length)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error('Error al cargar la bitácora de auditoría:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [page, filterAction, filterIP, filterUser])

  return (
    <div className="card">
      <h2>Bitácora de Auditoría del Sistema</h2>
      <p className="muted">Registro unificado de eventos y acciones de seguridad.</p>

      <div className="collection-toolbar" style={{ marginTop: 16, gap: 12 }}>
        <label style={{ flex: '1 1 180px' }}>
          <span>Tipo de Acción</span>
          <input
            type="text"
            value={filterAction}
            onChange={e => { setPage(1); setFilterAction(e.target.value) }}
            placeholder="Ej. READ, CREATE, DELETE..."
          />
        </label>
        <label style={{ flex: '1 1 180px' }}>
          <span>Dirección IP</span>
          <input
            type="text"
            value={filterIP}
            onChange={e => { setPage(1); setFilterIP(e.target.value) }}
            placeholder="Ej. 192.168.1.1"
          />
        </label>
        <label style={{ flex: '1 1 180px' }}>
          <span>Usuario / Rol</span>
          <input
            type="text"
            value={filterUser}
            onChange={e => { setPage(1); setFilterUser(e.target.value) }}
            placeholder="Ej. admin..."
          />
        </label>
      </div>

      {loading ? (
        <p style={{ marginTop: 20 }}>Cargando registros de auditoría...</p>
      ) : items.length === 0 ? (
        <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
          No se encontraron eventos registrados con los criterios especificados.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha y Hora</th>
                <th>Acción</th>
                <th>Usuario</th>
                <th>Rol</th>
                <th>IP Origen</th>
                <th>Navegador / Equipo</th>
                <th>Detalles del Evento</th>
              </tr>
            </thead>
            <tbody>
              {items.map(log => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                  </td>
                  <td>
                    <span className="badge">{log.action_type || 'ACCION'}</span>
                  </td>
                  <td>
                    <strong>{log.username || log.user_id || 'Anónimo'}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
                      {log.user_role || 'Sin rol'}
                    </span>
                  </td>
                  <td>
                    <code>{log.ip_address || 'Sin IP'}</code>
                  </td>
                  <td style={{ fontSize: '0.85rem' }} title={log.user_agent}>
                    {parseBrowser(log.user_agent)}
                  </td>
                  <td style={{ fontSize: '0.9rem' }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination-footer" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="button secondary sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Anterior
        </button>
        <span style={{ fontSize: '0.85rem', color: '#6c757d' }}>
          Página <strong>{page}</strong> · Total de eventos: <strong>{total}</strong>
        </span>
        <button className="button secondary sm" disabled={page * perPage >= total} onClick={() => setPage(page + 1)}>
          Siguiente →
        </button>
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

export function ConsultationsModule() {
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Estados de los filtros
  const [filters, setFilters] = useState({
    q: '',
    doctor: '',
    startDate: '',
    endDate: ''
  });

  // Cargar consultas aplicando query params
  const fetchConsultations = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.q) queryParams.append('q', filters.q);
      if (filters.doctor) queryParams.append('doctor', filters.doctor);
      if (filters.startDate) queryParams.append('start_date', filters.startDate);
      if (filters.endDate) queryParams.append('end_date', filters.endDate);

      const res = await apiFetch(`/consultations?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConsultations(data);
      }
    } catch (err) {
      console.error('Error cargando consultas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsultations();
  }, []);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchConsultations();
  };

  const handleReset = () => {
    setFilters({ q: '', doctor: '', startDate: '', endDate: '' });
    // Llamar directamente sin filtros
    fetchConsultations();
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Consultas Médicas</h2>

      {/* Barra de Filtros */}
      <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 bg-gray-50 p-4 rounded shadow-sm">
        <div>
          <label className="block text-xs font-semibold mb-1">Buscar (Paciente/Diagnóstico)</label>
          <input
            type="text"
            name="q"
            value={filters.q}
            onChange={handleFilterChange}
            placeholder="Ej. Juan Pérez o Fiebre..."
            className="w-full border rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Médico</label>
          <input
            type="text"
            name="doctor"
            value={filters.doctor}
            onChange={handleFilterChange}
            placeholder="Dr. Silva"
            className="w-full border rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Desde</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            className="w-full border rounded p-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1">Hasta</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            className="w-full border rounded p-2 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 w-full"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm hover:bg-gray-400"
          >
            Limpiar
          </button>
        </div>
      </form>

      {/* Tabla de Resultados */}
      {loading ? (
        <p>Cargando consultas...</p>
      ) : (
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-100 text-left text-xs uppercase">
              <th className="p-2 border">Fecha</th>
              <th className="p-2 border">Paciente</th>
              <th className="p-2 border">Médico</th>
              <th className="p-2 border">Motivo</th>
              <th className="p-2 border">Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {consultations.length > 0 ? (
              consultations.map((item) => (
                <tr key={item.id} className="border-b text-sm">
                  <td className="p-2 border">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="p-2 border font-medium">{item.patient_name || 'Sin Nombre'}</td>
                  <td className="p-2 border">{item.doctor_name}</td>
                  <td className="p-2 border">{item.reason}</td>
                  <td className="p-2 border">{item.diagnosis || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  No se encontraron consultas con los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}


export function Users() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('list') // 'list' | 'create' | 'edit'
  
  // Usuario seleccionado para edición
  const [editingUser, setEditingUser] = useState(null)

  // Estados para búsqueda y filtros avanzados
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  // Formulario de Usuario (Crear / Editar)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'operator',
    location_id: ''
  })

  const [message, setMessage] = useState({ text: '', type: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [usersRes, locationsRes] = await Promise.all([
        apiFetch('/users'),
        apiFetch('/locations')
      ])
      if (usersRes.ok) setUsers(await usersRes.json() || [])
      if (locationsRes.ok) setLocations(await locationsRes.json() || [])
    } catch (err) {
      showMessage('Error de conexión al cargar datos', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  // --- NAVEGACIÓN Y CAMBIO DE VISTAS ---
  const handleSwitchToList = () => {
    setView('list')
    setEditingUser(null)
    setForm({ username: '', email: '', password: '', role: 'operator', location_id: '' })
  }

  const handleSwitchToCreate = () => {
    setForm({ username: '', email: '', password: '', role: 'operator', location_id: '' })
    setEditingUser(null)
    setView('create')
  }

  const handleSwitchToEdit = (u) => {
    setEditingUser(u)
    setForm({
      username: u.username || '',
      email: u.email || '',
      password: '', // Se deja vacío a menos que se quiera actualizar
      role: u.role || 'viewer',
      location_id: u.location_id || ''
    })
    setView('edit')
  }

  // --- OPERACIONES CRUD ---

  // 1. CREAR / GUARDAR
  async function handleCreateSubmit(e) {
    e.preventDefault()
    if (!form.username || !form.password) {
      showMessage('Usuario y contraseña son requeridos', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify(form)
      })
      if (res.ok) {
        showMessage('Usuario creado exitosamente', 'success')
        await load()
        handleSwitchToList()
      } else {
        const data = await res.json().catch(() => ({}))
        showMessage(data.message || 'Error al crear usuario', 'error')
      }
    } catch (err) {
      showMessage('Error de red al crear usuario', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 2. ACTUALIZAR / EDITAR
  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!editingUser) return

    setIsSubmitting(true)
    try {
      const payload = {
        username: form.username,
        email: form.email,
        role: form.role,
        location_id: form.location_id || null
      }
      if (form.password.trim() !== '') {
        payload.password = form.password
      }

      const res = await apiFetch(`/users/${editingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        showMessage('Usuario actualizado correctamente', 'success')
        await load()
        handleSwitchToList()
      } else {
        const data = await res.json().catch(() => ({}))
        showMessage(data.message || 'Error al actualizar el usuario', 'error')
      }
    } catch (err) {
      showMessage('Error de conexión al actualizar', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. ELIMINAR CON CONFIRMACIÓN
  async function handleDeleteUser(u) {
    const confirmed = window.confirm(
      `⚠️ ¿Estás seguro de que deseas eliminar al usuario "${u.username}"?\nEsta acción no se puede deshacer.`
    )
    if (!confirmed) return

    try {
      const res = await apiFetch(`/users/${u.id}`, { method: 'DELETE' })
      if (res.ok) {
        showMessage(`Usuario "${u.username}" eliminado correctamente`, 'success')
        load()
      } else {
        const data = await res.json().catch(() => ({}))
        showMessage(data.message || 'No se pudo eliminar el usuario', 'error')
      }
    } catch (err) {
      showMessage('Error al conectar con el servidor', 'error')
    }
  }

  // --- LÓGICA DE FILTRADO AVANZADO ---
  const filteredUsers = users
    .filter(u => {
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        u.username?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        String(u.id).includes(query)

      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const matchesLocation =
        locationFilter === 'all' ||
        (locationFilter === 'none' && !u.location_id) ||
        String(u.location_id) === String(locationFilter)

      return matchesSearch && matchesRole && matchesLocation
    })
    .sort((a, b) => {
      if (sortBy === 'name') return (a.username || '').localeCompare(b.username || '')
      if (sortBy === 'id') return a.id - b.id
      if (sortBy === 'date') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
      return 0
    })

  // --- VISTA 1: CREAR USUARIO ---
  if (view === 'create') {
    return (
      <div className="card">
        <div className="card-header-row">
          <div>
            <h2>Nuevo Usuario</h2>
            <p className="muted">Registra las credenciales y rol del nuevo miembro del equipo.</p>
          </div>
          <button type="button" className="button secondary" onClick={handleSwitchToList}>
            ← Volver a la lista
          </button>
        </div>

        <form onSubmit={handleCreateSubmit} className="form-card" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <label>
              Nombre de usuario *
              <input
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                placeholder="Ej. jgonzales"
              />
            </label>
            <label>
              Correo Electrónico
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="ejemplo@hospital.com"
              />
            </label>
            <label>
              Contraseña *
              <input
                required
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
              />
            </label>
            <label>
              Rol
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="tenant_admin">Tenant Admin</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Área Asignada
              <select
                value={form.location_id}
                onChange={e => setForm({ ...form, location_id: e.target.value })}
              >
                <option value="">Sin asignación</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="button-row" style={{ marginTop: 20 }}>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando...' : 'Crear Usuario'}
            </button>
            <button type="button" className="secondary" onClick={handleSwitchToList}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  // --- VISTA 2: EDITAR USUARIO (PANTALLA DEDICADA) ---
  if (view === 'edit') {
    return (
      <div className="card">
        <div className="card-header-row">
          <div>
            <h2>Editar Usuario #{editingUser?.id}</h2>
            <p className="muted">Actualiza los permisos, área o contraseña de {editingUser?.username}.</p>
          </div>
          <button type="button" className="button secondary" onClick={handleSwitchToList}>
            ← Volver a la lista
          </button>
        </div>

        <form onSubmit={handleEditSubmit} className="form-card" style={{ marginTop: 16 }}>
          <div className="form-grid">
            <label>
              Nombre de usuario *
              <input
                required
                value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label>
              Correo Electrónico
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label>
              Nueva Contraseña (Opcional)
              <input
                type="password"
                placeholder="Dejar en blanco para mantener la actual"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              Rol
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="tenant_admin">Tenant Admin</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              Área / Ubicación
              <select
                value={form.location_id}
                onChange={e => setForm({ ...form, location_id: e.target.value })}
              >
                <option value="">Sin asignación</option>
                {locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="button-row" style={{ marginTop: 20 }}>
            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Guardando Cambios...' : 'Actualizar Usuario'}
            </button>
            <button type="button" className="secondary" onClick={handleSwitchToList}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    )
  }

  // --- VISTA 3: LISTADO Y FILTROS (VISTA PRINCIPAL) ---
  return (
    <div className="card">
      {message.text && (
        <div className={`form-message ${message.type === 'error' ? 'error' : ''}`} style={{ marginBottom: 12 }}>
          {message.type === 'success' ? '✅ ' : '⚠️ '}
          {message.text}
        </div>
      )}

      <div className="card-header-row">
        <div>
          <h2>Gestión de usuarios</h2>
          <p className="muted">Administra los accesos, roles y asignación de áreas operativas.</p>
        </div>
        <button type="button" className="button" onClick={handleSwitchToCreate}>
          + Agregar Usuario
        </button>
      </div>

      {/* BLOQUE DE FILTROS AVANZADOS */}
      <div className="collection-toolbar" style={{ flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
        <label className="collection-search" style={{ flex: '1 1 200px' }}>
          <span>Búsqueda general</span>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por ID, usuario o correo..."
          />
        </label>

        <label style={{ flex: '1 1 140px' }}>
          <span>Filtrar por Rol</span>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="all">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="tenant_admin">Tenant Admin</option>
            <option value="operator">Operator</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>

        <label style={{ flex: '1 1 160px' }}>
          <span>Filtrar por Área</span>
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
            <option value="all">Todas las áreas</option>
            <option value="none">Sin asignación</option>
            {locations.map(loc => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </label>

        <label style={{ flex: '1 1 140px' }}>
          <span>Ordenar por</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="name">Nombre</option>
            <option value="id">ID</option>
            <option value="date">Fecha de creación</option>
          </select>
        </label>
      </div>

      {/* TABLA DE RESULTADOS */}
      {loading ? (
        <p style={{ marginTop: 20 }}>Cargando usuarios...</p>
      ) : filteredUsers.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p className="muted">No se encontraron usuarios con los filtros especificados.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Usuario</th>
                <th>Correo</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Fecha Creado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const areaName = locations.find(l => String(l.id) === String(u.location_id))?.name || 'Sin asignación'
                return (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td><strong>{u.username}</strong></td>
                    <td>{u.email || '—'}</td>
                    <td>
                      <span className={`badge ${u.role}`}>{u.role}</span>
                    </td>
                    <td>{areaName}</td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="button-row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                        <button
                          type="button"
                          className="button secondary sm"
                          onClick={() => handleSwitchToEdit(u)}
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          className="button danger sm"
                          onClick={() => handleDeleteUser(u)}
                        >
                          🗑️ Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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