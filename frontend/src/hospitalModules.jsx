import React, { useEffect, useState } from 'react'
import { apiFetch } from './api'

export function Patients(){
  const [patients, setPatients] = useState([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ full_name: '', dni: '', date_of_birth: '', phone: '', email: '', sex: '', blood_type: '', allergies: '' })
  const [message, setMessage] = useState('')

  async function load(q = ''){
    const res = await apiFetch(`/patients?q=${encodeURIComponent(q)}`)
    if (res.ok) setPatients(await res.json())
  }

  useEffect(() => { load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/patients', { method: 'POST', body: JSON.stringify(form) })
    const json = await res.json()
    if (res.ok){
      setMessage('Paciente registrado correctamente')
      setForm({ full_name: '', dni: '', date_of_birth: '', phone: '', email: '', sex: '', blood_type: '', allergies: '' })
      load(query)
    } else {
      setMessage(json.message || 'No se pudo crear el paciente')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Gestión de pacientes</h2>
        <form onSubmit={submit}>
          <label>Nombre completo<input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></label>
          <label>DNI<input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} /></label>
          <label>Fecha de nacimiento<input value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} /></label>
          <label>Teléfono<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></label>
          <label>Correo<input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
          <label>Sexo<input value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })} /></label>
          <label>Tipo de sangre<input value={form.blood_type} onChange={e => setForm({ ...form, blood_type: e.target.value })} /></label>
          <label>Alergias<input value={form.allergies} onChange={e => setForm({ ...form, allergies: e.target.value })} /></label>
          <button type="submit">Registrar paciente</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>

      <div className="card">
        <h2>Buscar paciente</h2>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nombre, DNI o correo" />
        <button onClick={() => load(query)} style={{ marginLeft: 8 }}>Buscar</button>
        <div className="items-grid" style={{ marginTop: 16 }}>
          {patients.map(patient => (
            <div key={patient.id} className="item-card">
              <h3>{patient.full_name}</h3>
              <p>DNI: {patient.dni}</p>
              <p>HC: {patient.medical_record_number}</p>
              <p>Tel: {patient.phone || '—'}</p>
              <p>Correo: {patient.email || '—'}</p>
              <span className="meta">Estado: {patient.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Consultations(){
  const [consultations, setConsultations] = useState([])
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState({ patient_id: '', doctor_name: 'Dr. Demo', reason: '', symptoms: '', diagnosis: '', treatment: '', prescription: '' })
  const [message, setMessage] = useState('')

  async function load(){
    const [consultRes, patientRes] = await Promise.all([apiFetch('/consultations'), apiFetch('/patients')])
    if (consultRes.ok) setConsultations(await consultRes.json())
    if (patientRes.ok) setPatients(await patientRes.json())
  }

  useEffect(() => { load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/consultations', { method: 'POST', body: JSON.stringify(form) })
    const json = await res.json()
    if (res.ok){
      setMessage('Consulta registrada')
      setForm({ patient_id: '', doctor_name: 'Dr. Demo', reason: '', symptoms: '', diagnosis: '', treatment: '', prescription: '' })
      load()
    } else {
      setMessage(json.message || 'Error al registrar consulta')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Registrar consulta médica</h2>
        <form onSubmit={submit}>
          <label>Paciente<select value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
            <option value="">Seleccionar paciente</option>
            {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
          </select></label>
          <label>Médico<input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} /></label>
          <label>Motivo<input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></label>
          <label>Síntomas<input value={form.symptoms} onChange={e => setForm({ ...form, symptoms: e.target.value })} /></label>
          <label>Diagnóstico<input value={form.diagnosis} onChange={e => setForm({ ...form, diagnosis: e.target.value })} /></label>
          <label>Tratamiento<input value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })} /></label>
          <label>Receta<input value={form.prescription} onChange={e => setForm({ ...form, prescription: e.target.value })} /></label>
          <button type="submit">Guardar consulta</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>
      <div className="card">
        <h2>Consultas recientes</h2>
        <div className="items-grid">
          {consultations.map(item => (
            <div key={item.id} className="item-card">
              <h3>{item.reason}</h3>
              <p>{item.diagnosis || 'Sin diagnóstico'}</p>
              <p>{item.doctor_name}</p>
              <span className="meta">{new Date(item.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Appointments(){
  const [appointments, setAppointments] = useState([])
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState({ patient_id: '', doctor_name: 'Dra. Mendoza', specialty: 'Cardiología', appointment_date: '', notes: '' })
  const [message, setMessage] = useState('')

  async function load(){
    const [aptRes, patientRes] = await Promise.all([apiFetch('/appointments'), apiFetch('/patients')])
    if (aptRes.ok) setAppointments(await aptRes.json())
    if (patientRes.ok) setPatients(await patientRes.json())
  }

  useEffect(() => { load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/appointments', { method: 'POST', body: JSON.stringify(form) })
    const json = await res.json()
    if (res.ok){
      setMessage('Cita creada')
      setForm({ patient_id: '', doctor_name: 'Dra. Mendoza', specialty: 'Cardiología', appointment_date: '', notes: '' })
      load()
    } else {
      setMessage(json.message || 'Error al crear cita')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Programar cita</h2>
        <form onSubmit={submit}>
          <label>Paciente<select value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
            <option value="">Seleccionar paciente</option>
            {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
          </select></label>
          <label>Médico<input value={form.doctor_name} onChange={e => setForm({ ...form, doctor_name: e.target.value })} /></label>
          <label>Especialidad<input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} /></label>
          <label>Fecha<input value={form.appointment_date} onChange={e => setForm({ ...form, appointment_date: e.target.value })} /></label>
          <label>Notas<input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          <button type="submit">Guardar cita</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>
      <div className="card">
        <h2>Citas programadas</h2>
        <div className="items-grid">
          {appointments.map(item => (
            <div key={item.id} className="item-card">
              <h3>{item.specialty}</h3>
              <p>{item.doctor_name}</p>
              <p>{item.appointment_date}</p>
              <p>{item.notes || 'Sin notas'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Documents(){
  const [documents, setDocuments] = useState([])
  const [patients, setPatients] = useState([])
  const [form, setForm] = useState({ patient_id: '', document_type: 'result', file_name: '', description: '' })
  const [message, setMessage] = useState('')

  async function load(){
    const [docsRes, patientRes] = await Promise.all([apiFetch('/documents'), apiFetch('/patients')])
    if (docsRes.ok) setDocuments(await docsRes.json())
    if (patientRes.ok) setPatients(await patientRes.json())
  }

  useEffect(() => { load() }, [])

  async function submit(e){
    e.preventDefault()
    const res = await apiFetch('/documents', { method: 'POST', body: JSON.stringify(form) })
    const json = await res.json()
    if (res.ok){
      setMessage('Documento registrado')
      setForm({ patient_id: '', document_type: 'result', file_name: '', description: '' })
      load()
    } else {
      setMessage(json.message || 'Error al registrar documento')
    }
  }

  return (
    <div>
      <div className="card form-card">
        <h2>Subir documento clínico</h2>
        <form onSubmit={submit}>
          <label>Paciente<select value={form.patient_id} onChange={e => setForm({ ...form, patient_id: e.target.value })}>
            <option value="">Seleccionar paciente</option>
            {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.full_name}</option>)}
          </select></label>
          <label>Tipo<input value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })} /></label>
          <label>Nombre del archivo<input value={form.file_name} onChange={e => setForm({ ...form, file_name: e.target.value })} /></label>
          <label>Descripción<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
          <button type="submit">Guardar documento</button>
        </form>
        {message && <div className="form-message">{message}</div>}
      </div>
      <div className="card">
        <h2>Documentos cargados</h2>
        <div className="items-grid">
          {documents.map(item => (
            <div key={item.id} className="item-card">
              <h3>{item.file_name}</h3>
              <p>{item.document_type}</p>
              <p>{item.description || 'Sin descripción'}</p>
              <span className="meta">Estado: {item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Reports(){
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
            <div className="stat-card"><span className="stat-value">{data.summary.patients}</span><span className="stat-label">Pacientes</span></div>
            <div className="stat-card"><span className="stat-value">{data.summary.consultations}</span><span className="stat-label">Consultas</span></div>
            <div className="stat-card"><span className="stat-value">{data.summary.appointments}</span><span className="stat-label">Citas</span></div>
            <div className="stat-card"><span className="stat-value">{data.summary.documents}</span><span className="stat-label">Documentos</span></div>
            <div className="stat-card"><span className="stat-value">{data.summary.active_alerts}</span><span className="stat-label">Alertas activas</span></div>
          </div>
          <h3>Consultas recientes</h3>
          <div className="items-grid">
            {data.recent_consultations.map(item => (
              <div key={item.id} className="item-card">
                <h3>{item.reason}</h3>
                <p>{item.diagnosis || 'Sin diagnóstico'}</p>
                <span className="meta">{new Date(item.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p>Cargando reportes...</p>}
    </div>
  )
}
