import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,


} from 'recharts'
import { apiFetch } from './api'
import { useAuth } from './AuthContext'
import {
  User,
  Mail,
  Shield,
  MapPin,
  Key,
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  Stethoscope,
  UserCheck
} from 'lucide-react'
// ============================================================
// Shared UX / utilities
// ============================================================

const INITIAL_PATIENT = {
  document_type: 'dni',
  document_number: '',
  full_name: '',
  date_of_birth: '',
  phone_country: '+51',
  phone_number: '',
  email: '',
  sex: '',
  blood_type: '',
  allergies: '',
}

const INITIAL_CONSULTATION = {
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
  prescription: '',
}

const PHONE_CONFIGS = {
  '+51': { country: 'Perú', length: 9 },
  '+52': { country: 'México', length: 10 },
  '+54': { country: 'Argentina', length: 10 },
  '+57': { country: 'Colombia', length: 9 },
  '+1': { country: 'Estados Unidos', length: 10 },
}

const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const specialties = ['Cardiología', 'Pediatría', 'Medicina General', 'Dermatología', 'Ginecología']

const cx = (...values) => values.filter(Boolean).join(' ')

const calculateBMI = (weight, height) => {
  const w = Number.parseFloat(weight)
  const h = Number.parseFloat(height) / 100
  if (!w || !h || h <= 0) return ''
  return (w / (h * h)).toFixed(2)
}


const getBMIState = (bmi) => {
  const value = Number.parseFloat(bmi)
  if (!value) return { label: 'Sin calcular', tone: 'neutral' }
  if (value < 18.5) return { label: 'Bajo peso', tone: 'warning' }
  if (value < 25) return { label: 'Normal', tone: 'success' }
  if (value < 30) return { label: 'Sobrepeso', tone: 'warning' }
  return { label: 'Obesidad', tone: 'danger' }
}

const parseBrowser = (ua) => {
  if (!ua) return 'Desconocido'
  if (ua.includes('Edg')) return 'Microsoft Edge'
  if (ua.includes('Chrome')) return 'Google Chrome'
  if (ua.includes('Firefox')) return 'Mozilla Firefox'
  if (ua.includes('Safari')) return 'Apple Safari'
  return 'Navegador Web'
}

const formatDate = (value, options = { dateStyle: 'medium' }) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-PE', options).format(date)
}

const formatDateTime = (value) =>
  formatDate(value, { dateStyle: 'medium', timeStyle: 'short' })

const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(id)
  }, [value, delay])
  return debounced
}

const getUserRole = (user) => user?.role || user?.user_metadata?.role || 'viewer'
const isAdminUser = (user) => ['admin', 'tenant_admin'].includes(getUserRole(user))

// ============================================================
// Shared UI components
// ============================================================

function Toast({ toast, onClose }) {
  if (!toast?.text) return null
  return (
    <div className={cx('toast', `toast-${toast.type || 'info'}`)} role="status">
      <div className="toast-icon" aria-hidden="true">
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}
      </div>
      <div className="toast-content">
        <strong>{toast.title || (toast.type === 'error' ? 'Ocurrió un problema' : 'Información')}</strong>
        <span>{toast.text}</span>
      </div>
      <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar notificación">×</button>
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState({ text: '', type: 'info' })
  const timeoutRef = useRef(null)

  const notify = useCallback((text, type = 'info', title = '') => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    setToast({ text, type, title })
    timeoutRef.current = window.setTimeout(() => setToast({ text: '', type: 'info' }), 4500)
  }, [])

  useEffect(() => () => timeoutRef.current && window.clearTimeout(timeoutRef.current), [])
  return [toast, notify, () => setToast({ text: '', type: 'info' })]
}

function LoadingState({ label = 'Cargando información...' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

function EmptyState({ icon = '⌕', title = 'No encontramos registros', description = 'Prueba cambiando los filtros o crea un nuevo registro.' }) {
  return (
    <div className="empty-state enhanced-empty">
      <div className="empty-icon" aria-hidden="true">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}

function PageShell({ title, subtitle, actions, children, className = '' }) {
  return (
    <div className={cx('page-container', 'page-shell', className)}>
      <div className="page-heading">
        <div>
          <div className="eyebrow">Hospital TIC</div>
          <h1>{title}</h1>
          {subtitle && <p className="muted page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-heading-actions">{actions}</div>}
      </div>
      {children}
    </div>
  )
}

function SectionCard({ title, description, icon, actions, children, className = '' }) {
  return (
    <section className={cx('card', 'section-card', className)}>
      {(title || actions) && (
        <div className="section-heading">
          <div className="section-heading-main">
            {icon && <span className="section-icon" aria-hidden="true">{icon}</span>}
            <div>
              {title && <h2 className="section-title">{title}</h2>}
              {description && <p className="muted section-description">{description}</p>}
            </div>
          </div>
          {actions && <div className="section-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}


// ============================================================
// Componente StatCard Moderno (Sin Emojis, con Iconos SVG Clínicos)
// ============================================================

function StatCard({ icon, label, value, hint, tone = 'primary' }) {
  const toneStyles = {
    primary: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
    success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    warning: 'border-amber-500/20 bg-amber-500/5 text-amber-400',
    danger: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
  }

  return (
    <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-5 shadow-xl flex items-center gap-4 transition-all duration-200 hover:border-slate-700">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${toneStyles[tone] || toneStyles.primary} shrink-0`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <strong className="text-2xl font-bold text-slate-100 tracking-tight my-0.5">{value}</strong>
        {hint && <span className="text-xs text-slate-500">{hint}</span>}
      </div>
    </div>
  )
}

// ============================================================
// Iconos Vectoriales para las Tarjetas
// ============================================================
const StatIcons = {
  Patients: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Consultations: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  Time: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
}

function SearchField({ value, onChange, placeholder, onEnter, loading = false }) {
  return (
    <div className="smart-search">
      <span className="search-icon" aria-hidden="true">⌕</span>
      <input
        className="form-control smart-search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onEnter?.()
        }}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value && !loading && (
        <button type="button" className="icon-button search-clear" onClick={() => onChange('')} aria-label="Limpiar búsqueda">×</button>
      )}
      {loading && <span className="search-spinner spinner" aria-hidden="true" />}
    </div>
  )
}

function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={e => e.stopPropagation()}>
        <div className={cx('modal-icon', danger && 'danger')}>{danger ? '!' : '?'}</div>
        <h3 id="confirm-title">{title}</h3>
        <p className="muted">{message}</p>
        <div className="button-row modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className={cx('btn', danger ? 'btn-danger' : 'btn-primary')} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function InlineAlert({ type = 'info', children }) {
  if (!children) return null
  return <div className={cx('alert', `alert-${type}`, 'inline-alert')}>{children}</div>
}

function DataTable({ columns, rows, getRowKey, emptyTitle = 'Sin datos' }) {
  if (!rows?.length) return <EmptyState title={emptyTitle} />
  return (
    <div className="table-wrapper polished-table">
      <table className="data-table">
        <thead>
          <tr>{columns.map(column => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey?.(row) ?? index}>
              {columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Pagination({ page, perPage, total, onPrev, onNext }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  return (
    <div className="pagination enhanced-pagination">
      <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={onPrev}>← Anterior</button>
      <span>Hoja <strong>{page}</strong> de <strong>{totalPages}</strong> · {total} registros</span>
      <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={onNext}>Siguiente →</button>
    </div>
  )
}





// ============================================================
// Patients
// ============================================================

export function Patients() {
  const { user } = useAuth()
  const [patients, setPatients] = useState([])
  const [query, setQuery] = useState('')
  const [view, setView] = useState('list') // 'list' | 'create' | 'detail'
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [previewDocument, setPreviewDocument] = useState(null)
  const [patientDocuments, setPatientDocuments] = useState([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [form, setForm] = useState(INITIAL_PATIENT)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [toast, notify, clearToast] = useToast()
  const debouncedQuery = useDebouncedValue(query)
  const isAdmin = isAdminUser(user)

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const res = await apiFetch(`/patients?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('No se pudo cargar pacientes')
      setPatients(await res.json() || [])
    } catch (error) {
      console.error(error)
      notify('No fue posible cargar la lista de pacientes.', 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (view === 'list') load(debouncedQuery)
  }, [debouncedQuery, view, load])

  const loadPatientDetail = async (patient) => {
    setSelectedPatient(patient)
    setView('detail')
    setLoadingDocs(true)
    try {
      // Endpoint simulado o real para obtener documentos del paciente agrupados
      const res = await apiFetch(`/patients/${patient.id}/documents`)
      if (res.ok) {
        const docs = await res.json()
        setPatientDocuments(docs || [])
      } else {
        setPatientDocuments([])
      }
    } catch {
      setPatientDocuments([])
    } finally {
      setLoadingDocs(false)
    }
  }

  const handleDocumentChange = (value, docType = form.document_type) => {
    const cleanValue = docType === 'dni'
      ? value.replace(/\D/g, '')
      : value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    const maxLength = docType === 'dni' ? 8 : 12
    const documentNumber = cleanValue.slice(0, maxLength)
    setForm(prev => ({ ...prev, document_number: documentNumber }))

    if (!documentNumber) {
      setDocumentError('')
      return
    }

    const exists = patients.some(patient => {
      const values = [patient.dni, patient.document_number].filter(Boolean).map(String)
      return values.some(valueItem => valueItem.trim() === documentNumber)
    })
    setDocumentError(exists ? `El ${docType.toUpperCase()} ${documentNumber} ya está registrado.` : '')
  }

  const openCreate = () => {
    setForm(INITIAL_PATIENT)
    setDocumentError('')
    clearToast()
    setView('create')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (documentError) return notify('Corrige el documento antes de continuar.', 'error')

    setSaving(true)
    try {
      const phone = `${form.phone_country}${form.phone_number}`
      const res = await apiFetch('/patients', {
        method: 'POST',
        body: JSON.stringify({ ...form, dni: form.document_number, phone }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'No se pudo registrar al paciente')

      notify('Paciente registrado correctamente.', 'success', 'Registro completado')
      setForm(INITIAL_PATIENT)
      setDocumentError('')
      setView('list')
      await load(query)
    } catch (error) {
      notify(error.message || 'Error de conexión con el servidor.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deletePatient = async () => {
    if (!confirmDelete) return
    try {
      const res = await apiFetch('/patients', {
        method: 'DELETE',
        body: JSON.stringify({ patient_id: confirmDelete.id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'No se pudo eliminar')
      notify('Paciente eliminado correctamente.', 'success')
      setConfirmDelete(null)
      setView('list')
      await load(query)
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  // Agrupar documentos por tipo si existen
  const groupedDocuments = patientDocuments.reduce((acc, doc) => {
    const type = doc.category || doc.type || 'General'
    if (!acc[type]) acc[type] = []
    acc[type].push(doc)
    return acc
  }, {})

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      {/* MARCO GENERAL ESTILO DOCUMENTO */}
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* CABECERA Y ACCIONES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
              {view === 'create' ? 'Nuevo paciente' : view === 'detail' ? 'Expediente clínico del paciente' : 'Gestión de pacientes'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
              {view === 'create' ? 'Registra un expediente clínico completo en pocos pasos.' : view === 'detail' ? `Visualización de datos e historial documental de ${selectedPatient?.full_name}` : 'Consulta, identifica y gestiona los expedientes clínicos.'}
            </p>
          </div>

          <div>
            {view === 'list' ? (
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={openCreate}
              >
                + Nuevo paciente
              </button>
            ) : (
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => setView('list')}
              >
                ← Volver al listado
              </button>
            )}
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        {view === 'create' ? (
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Datos de identificación</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Los campos marcados con * son obligatorios.</p>
            </div>

            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Tipo de documento *</label>
                  <select
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.document_type}
                    onChange={e => { setForm(p => ({ ...p, document_type: e.target.value, document_number: '' })); setDocumentError('') }}
                  >
                    <option value="dni">DNI</option>
                    <option value="ce">Carnet de extranjería</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Número de documento *</label>
                  <input
                    required
                    style={{ backgroundColor: '#0f172a', border: `1px solid ${documentError ? '#ef4444' : '#334155'}`, color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.document_number}
                    onChange={e => handleDocumentChange(e.target.value)}
                    placeholder={form.document_type === 'dni' ? '8 dígitos' : 'Hasta 12 caracteres'}
                  />
                  {documentError && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{documentError}</span>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Nombre completo *</label>
                  <input
                    required
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="Nombres y apellidos"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Fecha de nacimiento *</label>
                  <input
                    required
                    type="date"
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    max={new Date().toISOString().slice(0, 10)}
                    value={form.date_of_birth}
                    onChange={e => setForm(p => ({ ...p, date_of_birth: e.target.value }))}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Sexo *</label>
                  <select
                    required
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.sex}
                    onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    <option value="female">Femenino</option>
                    <option value="male">Masculino</option>
                    <option value="other">Otro / Prefiero no decir</option>
                  </select>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '0.5rem 0' }} />

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Contacto y antecedentes</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>País</label>
                  <select
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.phone_country}
                    onChange={e => setForm(p => ({ ...p, phone_country: e.target.value, phone_number: '' }))}
                  >
                    {Object.entries(PHONE_CONFIGS).map(([code, info]) => <option key={code} value={code}>{code} · {info.country}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Teléfono *</label>
                  <input
                    required
                    inputMode="numeric"
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.phone_number}
                    onChange={e => setForm(p => ({ ...p, phone_number: e.target.value.replace(/\D/g, '').slice(0, PHONE_CONFIGS[form.phone_country]?.length || 10) }))}
                    placeholder={`${PHONE_CONFIGS[form.phone_country]?.length || 10} dígitos`}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Correo</label>
                  <input
                    type="email"
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="correo@ejemplo.com"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Tipo de sangre</label>
                  <select
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={form.blood_type}
                    onChange={e => setForm(p => ({ ...p, blood_type: e.target.value }))}
                  >
                    <option value="">Seleccionar</option>
                    {bloodTypes.map(type => <option key={type}>{type}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Alergias</label>
                  <textarea
                    rows={3}
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none', resize: 'vertical' }}
                    value={form.allergies}
                    onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))}
                    placeholder="Ninguna o detalla medicamentos/alimentos conocidos"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
                <button type="button" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }} onClick={() => setView('list')}>Cancelar</button>
                <button type="submit" style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: (saving || Boolean(documentError)) ? 0.5 : 1 }} disabled={saving || Boolean(documentError)}>{saving ? 'Guardando…' : 'Registrar paciente'}</button>
              </div>
            </form>
          </div>
        ) : view === 'detail' && selectedPatient ? (
          /* VISTA DE DETALLE / EXPEDIENTE COMPLETO CON DOCUMENTOS POR TIPO */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

            {/* Tarjeta de Resumen del Paciente */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Historia Clínica · {selectedPatient.medical_record_number || '—'}</span>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', margin: '0.25rem 0 0 0' }}>{selectedPatient.full_name}</h2>
                </div>
                <span className="badge badge-success">{selectedPatient.status || 'Activo'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#090d16', padding: '1rem', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Documento</span><strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{selectedPatient.dni || selectedPatient.document_number || '—'}</strong></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Teléfono</span><strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{selectedPatient.phone || '—'}</strong></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Correo</span><strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{selectedPatient.email || '—'}</strong></div>
                <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Tipo de Sangre</span><strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{selectedPatient.blood_type || 'No especificado'}</strong></div>
                <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}><span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase' }}>Alergias / Observaciones</span><strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>{selectedPatient.allergies || 'Ninguna registrada'}</strong></div>
              </div>
            </div>

            {/* SECCIÓN DE DOCUMENTOS DIVIDIDOS POR TIPOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Documentos e Historial Clínico</h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Archivos, recetas, exámenes y reportes asociados al paciente.</p>
              </div>

              {loadingDocs ? (
                <div style={{ padding: '2rem 0', textAlign: 'center' }}><LoadingState label="Cargando documentos del paciente…" /></div>
              ) : patientDocuments.length === 0 ? (
                <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>No hay documentos registrados para este paciente en el sistema.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {Object.entries(groupedDocuments).map(([category, docs]) => (
                    <div key={category} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#3b82f6', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{category}</h4>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{docs.length} archivo(s)</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                        {docs.map((doc, idx) => (
                          <div
                            key={idx}
                            onClick={() => setPreviewDocument(doc)}
                            style={{
                              backgroundColor: '#090d16',
                              border: '1px solid #1e293b',
                              borderRadius: '12px',
                              padding: '1rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.5rem',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = '#3b82f6'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = '#1e293b'}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <strong style={{ fontSize: '0.875rem', color: '#f8fafc' }}>{doc.title || doc.name || 'Documento clínico'}</strong>
                              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{formatDate(doc.created_at)}</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>{doc.description || 'Sin descripción adicional.'}</p>
                            <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 500, marginTop: '0.25rem' }}>🔍 Clic para previsualizar</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

            {/* SECCIÓN DE BÚSQUEDA */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Buscar pacientes</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Busca por nombre, DNI o correo.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SearchField value={query} onChange={setQuery} placeholder="Buscar por DNI, nombre o correo…" loading={loading} />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{patients.length} resultados</span>
              </div>
            </div>

            {/* LISTADO DE PACIENTES CON EFECTO HOVER ELEVADO */}
            {loading ? (
              <div style={{ padding: '3rem 0', textAlign: 'center' }}><LoadingState label="Cargando pacientes…" /></div>
            ) : patients.length === 0 ? (
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem' }}>
                <EmptyState title="No hay pacientes para mostrar" description={query ? 'Prueba con otro nombre, documento o correo.' : 'Todavía no existen pacientes registrados.'} />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', width: '100%' }}>
                {patients.map(patient => (
                  <article
                    key={patient.id}
                    onClick={() => loadPatientDetail(patient)}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #1e293b',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease-in-out'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.15)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0px)'
                      e.currentTarget.style.borderColor = '#1e293b'
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>HC · {patient.medical_record_number || '—'}</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0.2rem 0 0 0' }}>{patient.full_name}</h3>
                      </div>
                      <span className="badge badge-success">{patient.status || 'Activo'}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Documento</span><strong style={{ color: '#f8fafc' }}>{patient.dni || patient.document_number || '—'}</strong></div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Teléfono</span><strong style={{ color: '#f8fafc' }}>{patient.phone || '—'}</strong></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}><span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Correo</span><strong style={{ color: '#f8fafc', wordBreak: 'break-all' }}>{patient.email || '—'}</strong></div>
                      <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}><span style={{ fontSize: '0.65rem', textTransform: 'uppercase' }}>Registro</span><strong style={{ color: '#f8fafc' }}>{formatDate(patient.created_at)}</strong></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>ID #{patient.id}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          style={{ backgroundColor: '#ef4444', border: 'none', color: '#ffffff', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                          onClick={(e) => { e.stopPropagation(); setConfirmDelete(patient); }}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Eliminar paciente"
        message={confirmDelete ? `Eliminarás el registro de ${confirmDelete.full_name}. Esta acción no se puede deshacer.` : ''}
        confirmLabel="Sí, eliminar"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={deletePatient}
      />
      onClick={() => {
        console.log("Objeto documento completo:", doc); // Revisa esto en la consola (F12)
        setPreviewDocument(doc);
      }}
      {/* MODAL DE PREVISIÓN A PANTALLA COMPLETA */}
      {previewDocument && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '2rem',
          boxSizing: 'border-box'
        }}>
          <div style={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '1200px',
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            overflow: 'hidden'
          }}>
            {/* Cabecera del Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  {previewDocument.title || previewDocument.name || 'Documento clínico'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Registrado el {formatDate(previewDocument.created_at)}</span>
              </div>
              <button
                onClick={() => setPreviewDocument(null)}
                style={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Cuerpo principal dividido en dos columnas: Visor PDF + Detalles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', flex: 1, overflow: 'hidden' }}>

              {/* Columna Izquierda: Visor del PDF */}
              <div style={{ backgroundColor: '#090d16', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {previewDocument.file_url || previewDocument.url ? (
                  <iframe
                    src={previewDocument.file_url || previewDocument.url}
                    title="Vista previa del PDF"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'center', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#64748b', fontSize: '0.875rem' }}>
                    No hay una ruta de archivo disponible para visualizar.
                  </div>
                )}
              </div>

              {/* Columna Derecha: Información del documento */}
              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', overflowY: 'auto', backgroundColor: 'rgba(15, 23, 42, 0.4)' }}>
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.5rem 0' }}>Descripción</h4>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                    {previewDocument.description || 'Sin descripción adicional proporcionada para este archivo.'}
                  </p>
                </div>

                <div style={{ backgroundColor: '#090d16', padding: '1rem', borderRadius: '12px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Nombre del archivo</span>
                    <p style={{ fontSize: '0.85rem', color: '#f8fafc', margin: '0.15rem 0 0 0', wordBreak: 'break-all' }}>{previewDocument.name || previewDocument.title || '—'}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Fecha de carga</span>
                    <p style={{ fontSize: '0.85rem', color: '#f8fafc', margin: '0.15rem 0 0 0' }}>{formatDate(previewDocument.created_at)}</p>
                  </div>
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(previewDocument.file_url || previewDocument.url) && (
                    <a
                      href={previewDocument.file_url || previewDocument.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ backgroundColor: '#1e293b', color: '#f8fafc', textAlign: 'center', padding: '0.65rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 500, textDecoration: 'none', border: '1px solid #334155' }}
                    >
                      Abrir en pestaña nueva ↗
                    </a>
                  )}
                  <button
                    onClick={() => setPreviewDocument(null)}
                    style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '10px', padding: '0.65rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Cerrar ventana
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}


// ============================================================
// Consultations
// ============================================================

export function Consultations() {
  const [consultations, setConsultations] = useState([])
  const [patients, setPatients] = useState([])
  const [query, setQuery] = useState('')
  const [patientQuery, setPatientQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(INITIAL_CONSULTATION)
  const [toast, notify, clearToast] = useToast()
  const debouncedQuery = useDebouncedValue(query)
  const debouncedPatientQuery = useDebouncedValue(patientQuery, 250)
  const loadConsultations = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const res = await apiFetch(`/consultations?q=${encodeURIComponent(q)}`)
      if (!res.ok) throw new Error('No se pudo cargar el historial')
      setConsultations(await res.json() || [])
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [notify])

  const searchPatients = useCallback(async (q = '') => {
    try {
      const res = await apiFetch(`/patients?q=${encodeURIComponent(q)}`)
      if (!res.ok) return
      const data = await res.json() || []
      setPatients(data)
      if (data.length === 1) setForm(prev => ({ ...prev, patient_id: data[0].id }))
    } catch (error) {
      console.error(error)
    }
  }, [])

  useEffect(() => { loadConsultations() }, [loadConsultations])
  useEffect(() => {
    if (!showForm) loadConsultations(debouncedQuery)
  }, [debouncedQuery, showForm, loadConsultations])
  useEffect(() => {
    if (showForm) searchPatients(debouncedPatientQuery)
  }, [debouncedPatientQuery, showForm, searchPatients])

  const updateTriage = (field, value) => {
    const next = { ...form, [field]: value }
    if (field === 'weight_kg' || field === 'height_cm') {
      next.bmi = calculateBMI(field === 'weight_kg' ? value : form.weight_kg, field === 'height_cm' ? value : form.height_cm)
    }
    setForm(next)
  }

  const submit = async event => {
    event.preventDefault()
    if (!form.patient_id) return notify('Selecciona un paciente antes de guardar.', 'error')
    setSubmitting(true)
    try {
      const res = await apiFetch('/consultations', { method: 'POST', body: JSON.stringify(form) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'No se pudo registrar la consulta')
      notify('Consulta registrada correctamente.', 'success', 'Atención guardada')
      setForm(INITIAL_CONSULTATION)
      setPatientQuery('')
      setShowForm(false)
      await loadConsultations(query)
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPatient = useMemo(() => patients.find(p => String(p.id) === String(form.patient_id)), [patients, form.patient_id])
  const bmiState = getBMIState(form.bmi)

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      {/* MARCO GENERAL ESTILO DOCUMENTO */}
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* CABECERA Y ACCIONES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
              {showForm ? 'Nueva consulta médica' : 'Consultas médicas'}
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
              {showForm ? 'Registra atención, triaje, diagnóstico y tratamiento desde una sola vista.' : 'Explora y gestiona el historial de atención.'}
            </p>
          </div>

          <div>
            {!showForm ? (
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => { setForm(INITIAL_CONSULTATION); setShowForm(true); }}
              >
                + Nueva consulta
              </button>
            ) : (
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => setShowForm(false)}
              >
                ← Volver al historial
              </button>
            )}
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        {!showForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%' }}>

            {/* SECCIÓN DE BÚSQUEDA */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Buscar en el historial</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Filtra por paciente, diagnóstico, motivo o médico.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <SearchField value={query} onChange={setQuery} placeholder="Paciente, diagnóstico, motivo o médico…" loading={loading} />
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{consultations.length} consultas</span>
              </div>
            </div>

            {/* LISTADO DE CONSULTAS CON EFECTO HOVER ELEVADO */}
            {loading ? (
              <div style={{ padding: '3rem 0', textAlign: 'center' }}><LoadingState label="Cargando consultas…" /></div>
            ) : consultations.length === 0 ? (
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem' }}>
                <EmptyState icon="🩺" title="No hay consultas coincidentes" description="Prueba con otros términos de búsqueda." />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', width: '100%' }}>
                {consultations.map(item => (
                  <article
                    key={item.id}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid #1e293b',
                      borderRadius: '16px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.25s ease-in-out'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-4px)'
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.15)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0px)'
                      e.currentTarget.style.borderColor = '#1e293b'
                      e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{formatDate(item.created_at)}</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0.2rem 0 0 0' }}>{item.patient_name || `Paciente #${item.patient_id}`}</h3>
                      </div>
                      <span className="badge badge-info">#{item.id}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.825rem', color: '#94a3b8', backgroundColor: '#090d16', padding: '0.85rem', borderRadius: '10px', border: '1px solid #1e293b' }}>
                      <p style={{ margin: 0 }}><strong style={{ color: '#f8fafc' }}>Motivo:</strong> {item.reason || 'Consulta general'}</p>
                      <p style={{ margin: 0 }}><strong style={{ color: '#f8fafc' }}>Diagnóstico:</strong> {item.diagnosis || '—'}</p>
                      <p style={{ margin: 0 }}><strong style={{ color: '#f8fafc' }}>Médico:</strong> {item.doctor_name || 'No asignado'}</p>
                    </div>

                    {(item.weight_kg || item.height_cm || item.bmi) && (
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', paddingTop: '0.25rem' }}>
                        <span>⚖ {item.weight_kg ?? '—'} kg</span>
                        <span>↕ {item.height_cm ?? '—'} cm</span>
                        <span>IMC {item.bmi ?? '—'}</span>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

            {/* PACIENTE Y ATENCIÓN */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Paciente y atención</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Selecciona al paciente y registra el contexto de la atención.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Buscar paciente *</label>
                  <SearchField value={patientQuery} onChange={setPatientQuery} placeholder="Nombre o DNI…" loading={!patients.length && Boolean(patientQuery)} />
                  {patients.length > 0 && (
                    <div className="suggestions-panel" style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '10px', padding: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                      {patients.slice(0, 6).map(patient => (
                        <button type="button" key={patient.id} className={cx('suggestion-item', String(patient.id) === String(form.patient_id) && 'selected')} onClick={() => { setForm(p => ({ ...p, patient_id: patient.id })); setPatientQuery(patient.full_name) }} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: String(patient.id) === String(form.patient_id) ? '#1e293b' : 'transparent', border: 'none', color: '#f8fafc', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                          <span className="avatar-mini" style={{ width: '28px', height: '28px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.75rem' }}>{patient.full_name?.charAt(0)?.toUpperCase() || 'P'}</span>
                          <span style={{ display: 'flex', flexDirection: 'column' }}><strong>{patient.full_name}</strong><small style={{ color: '#94a3b8' }}>DNI {patient.dni || patient.document_number || '—'}</small></span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Paciente seleccionado *</label>
                  <select required style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.patient_id} onChange={e => setForm(p => ({ ...p, patient_id: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.dni || p.document_number || 'Sin documento'}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Médico tratante</label>
                  <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.doctor_name} onChange={e => setForm(p => ({ ...p, doctor_name: e.target.value }))} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Motivo</label>
                  <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Ej. chequeo de rutina, dolor de cabeza…" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Síntomas</label>
                  <textarea rows={3} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none', resize: 'vertical' }} value={form.symptoms} onChange={e => setForm(p => ({ ...p, symptoms: e.target.value }))} placeholder="Describe los síntomas reportados" />
                </div>
              </div>
              {selectedPatient && <InlineAlert type="success">Paciente seleccionado: <strong>{selectedPatient.full_name}</strong> · HC {selectedPatient.medical_record_number || '—'}</InlineAlert>}
            </div>

            {/* TRIAJE Y SIGNOS VITALES */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Triaje y signos vitales</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>El IMC se calcula automáticamente a partir del peso y la talla.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Peso (kg)</label>
                  <input type="number" min="0" step="0.1" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.weight_kg} onChange={e => updateTriage('weight_kg', e.target.value)} placeholder="70.5" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Talla (cm)</label>
                  <input type="number" min="0" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.height_cm} onChange={e => updateTriage('height_cm', e.target.value)} placeholder="170" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>IMC</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none', width: '100%' }} value={form.bmi} readOnly placeholder="0.00" />
                    <span className={cx('badge', `badge-${bmiState.tone === 'neutral' ? 'info' : bmiState.tone}`)}>{bmiState.label}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Presión arterial</label>
                  <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.blood_pressure} onChange={e => setForm(p => ({ ...p, blood_pressure: e.target.value }))} placeholder="120/80" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Perímetro abdominal (cm)</label>
                  <input type="number" min="0" step="0.1" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.abdominal_perimeter_cm} onChange={e => setForm(p => ({ ...p, abdominal_perimeter_cm: e.target.value }))} placeholder="85" />
                </div>
              </div>
            </div>

            {/* DIAGNÓSTICO Y TRATAMIENTO */}
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Diagnóstico y tratamiento</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Diagnóstico</label>
                  <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.diagnosis} onChange={e => setForm(p => ({ ...p, diagnosis: e.target.value }))} placeholder="Escribe el diagnóstico" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Plan de tratamiento</label>
                  <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={form.treatment} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))} placeholder="Indicaciones generales" />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Receta / prescripción</label>
                  <textarea rows={4} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.75rem 1rem', fontSize: '0.875rem', outline: 'none', resize: 'vertical' }} value={form.prescription} onChange={e => setForm(p => ({ ...p, prescription: e.target.value }))} placeholder="Medicamento, dosis y frecuencia…" />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
                <button type="button" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }} onClick={() => setShowForm(false)}>Cancelar</button>
                <button type="submit" style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }} disabled={submitting}>{submitting ? 'Guardando…' : 'Guardar consulta'}</button>
              </div>
            </div>

          </form>
        )}

      </div>
    </div>
  )
}




// ============================================================
// Locations
// ============================================================

export function Locations() {
  const [items, setItems] = useState([])
  const [selectedArea, setSelectedArea] = useState(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [showNewArea, setShowNewArea] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const [toast, notify, clearToast] = useToast()
  const canEdit = isAdminUser(user)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/locations')
      if (!res.ok) throw new Error('No se pudieron cargar las áreas')
      setItems(await res.json() || [])
    } catch (error) {
      notify(error.message, 'error')
    } finally { setLoading(false) }
  }, [notify])

  const loadDetail = useCallback(async id => {
    setLoadingDetail(true)
    try {
      const res = await apiFetch(`/locations/${id}`)
      if (!res.ok) throw new Error('No se pudo cargar el detalle')
      setDetail(await res.json())
    } catch (error) {
      notify(error.message, 'error')
    } finally { setLoadingDetail(false) }
  }, [notify])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selectedArea) loadDetail(selectedArea) }, [selectedArea, loadDetail])

  const submit = async event => {
    event.preventDefault()
    if (!newName.trim()) return notify('Ingresa un nombre para el área.', 'error')
    setSaving(true)
    try {
      const res = await apiFetch('/locations', { method: 'POST', body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.message || 'No se pudo crear el área')
      notify('Área creada correctamente.', 'success')
      setNewName(''); setNewDescription(''); setShowNewArea(false)
      await load()
      if (json.id) setSelectedArea(json.id)
    } catch (error) {
      notify(error.message, 'error')
    } finally { setSaving(false) }
  }

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      {/* MARCO GENERAL ESTILO DOCUMENTO */}
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* CABECERA Y ACCIONES */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
              Áreas del hospital
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
              Visualiza capacidad operativa, dispositivos y alertas por área.
            </p>
          </div>

          <div>
            {canEdit && (
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => setShowNewArea(v => !v)}
              >
                {showNewArea ? 'Cancelar' : '＋ Agregar área'}
              </button>
            )}
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        {/* FORMULARIO DE NUEVA ÁREA */}
        {showNewArea && (
          <form onSubmit={submit} style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Nueva área</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Completa la información para registrar una nueva zona.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Nombre *</label>
                <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej. UCI, Emergencias…" />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>Descripción</label>
                <input style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Descripción breve" />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
              <button type="button" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }} onClick={() => setShowNewArea(false)}>Cancelar</button>
              <button type="submit" style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }} disabled={saving}>{saving ? 'Guardando…' : 'Crear área'}</button>
            </div>
          </form>
        )}

        {/* MAPA OPERATIVO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Mapa operativo</h3>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>{items.length} áreas disponibles.</p>
          </div>

          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}><LoadingState /></div>
          ) : items.length === 0 ? (
            <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem' }}>
              <EmptyState icon="◈" title="No hay áreas registradas" description="Crea una nueva área para empezar." />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', width: '100%' }}>
              {items.map(area => {
                const isSelected = selectedArea === area.id;
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedArea(area.id)}
                    style={{
                      backgroundColor: 'rgba(15, 23, 42, 0.6)',
                      border: `1px solid ${isSelected ? '#3b82f6' : '#1e293b'}`,
                      borderRadius: '16px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      transition: 'all 0.25s ease-in-out'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.borderColor = '#3b82f6'
                        e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(59, 130, 246, 0.15)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.transform = 'translateY(0px)'
                        e.currentTarget.style.borderColor = '#1e293b'
                        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Área #{area.id}</div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: '0.1rem 0 0 0' }}>{area.name}</h3>
                      </div>
                      <span className={cx('status-dot', (area.active_alerts ?? 0) > 0 ? 'warning' : 'success')} style={{ width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' }} />
                    </div>

                    <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>{area.description || 'Sin descripción registrada'}</p>

                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#cbd5e1', paddingTop: '0.5rem', borderTop: '1px solid #1e293b', width: '100%' }}>
                      <span><strong>{area.device_count ?? 0}</strong> dispositivos</span>
                      <span><strong>{area.active_alerts ?? 0}</strong> alertas</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* DETALLE DE ÁREA SELECCIONADA */}
        {selectedArea && (
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Detalle · {detail?.name || `Área #${selectedArea}`}
                </h3>
              </div>
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer' }}
                onClick={() => { setSelectedArea(null); setDetail(null); }}
              >
                Cerrar
              </button>
            </div>

            {loadingDetail ? (
              <div style={{ padding: '2rem 0', textAlign: 'center' }}><LoadingState label="Cargando detalle…" /></div>
            ) : detail ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <StatCard icon="👥" label="Usuarios" value={detail.user_count ?? '—'} tone="primary" />
                <StatCard icon="📟" label="Dispositivos" value={detail.device_count ?? 0} tone="success" />
                <StatCard icon="⚠" label="Alertas activas" value={detail.active_alerts ?? 0} tone={detail.active_alerts ? 'danger' : 'success'} />
              </div>
            ) : (
              <EmptyState title="Sin información de detalle" />
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ============================================================
// Devices / audit
// ============================================================

export function Devices() {
  const [devices, setDevices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [clientInfo, setClientInfo] = useState({
    ip: 'No disponible',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
  });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', type: 'pc', location_id: '', status: 'active', ip_address: '' });

  const { user } = useAuth();
  const [toast, notify, clearToast] = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devRes, locRes] = await Promise.all([
        apiFetch('/devices'),
        apiFetch('/locations')
      ]);

      if (!devRes.ok || !locRes.ok) {
        throw new Error('No se pudo cargar el inventario o las ubicaciones.');
      }

      const devData = await devRes.json();
      const locData = await locRes.json();

      setDevices(Array.isArray(devData) ? devData : []);
      setLocations(Array.isArray(locData) ? locData : []);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();

    (async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const data = await res.json();
          setClientInfo(v => ({ ...v, ip: data.ip || v.ip }));
        }
      } catch (error) {
        console.warn('No se pudo obtener la IP pública:', error);
      }
    })();
  }, [loadData]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/devices', {
        method: 'POST',
        body: JSON.stringify({ ...formData, ip_address: clientInfo.ip })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Error al registrar dispositivo');
      }

      notify('Dispositivo registrado con éxito', 'success');
      setShowForm(false);
      setFormData({ name: '', type: 'pc', location_id: '', status: 'active', ip_address: '' });
      loadData();
    } catch (error) {
      notify(error.message, 'error');
    }
  };

  const filteredDevices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter(device => {
      const matchesQuery = !q || [device.name, device.type, device.ip_address]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
      const matchesStatus = status === 'all' || device.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [devices, search, status]);

  const locationMap = useMemo(() => {
    return new Map(locations.map(location => [String(location.id), location.name]));
  }, [locations]);

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
              Dispositivos y auditoría
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
              Inventario operativo y contexto de trazabilidad del cliente.
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', padding: '0.75rem 1.25rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
          >
            {showForm ? 'Cancelar' : '+ Registrar Dispositivo'}
          </button>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', padding: '1rem', fontSize: '0.875rem', color: '#93c5fd' }}>
          <strong>Sesión auditada:</strong> {user?.username || 'Anónimo'} · IP {clientInfo.ip}
        </div>

        {showForm && (
          <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', backgroundColor: '#0f172a', padding: '1.5rem', borderRadius: '16px', border: '1px solid #334155' }}>
            <input
              type="text"
              placeholder="Nombre del dispositivo"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', outline: 'none' }}
            />
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', outline: 'none' }}
            >
              <option value="pc">PC de Escritorio</option>
              <option value="laptop">Laptop</option>
              <option value="mobile">Móvil</option>
              <option value="tablet">Tablet</option>
              <option value="server">Servidor</option>
              <option value="other">Otro</option>
            </select>
            <select
              value={formData.location_id}
              onChange={e => setFormData({ ...formData, location_id: e.target.value })}
              style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', outline: 'none' }}
            >
              <option value="">Seleccionar ubicación</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button
              type="submit"
              style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', padding: '0.6rem 1rem' }}
            >
              Guardar Dispositivo
            </button>
          </form>
        )}

        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <SearchField value={search} onChange={setSearch} placeholder="Nombre, tipo o IP…" loading={loading} />
            </div>
            <select
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="available">Disponible</option>
              <option value="in_use">En uso</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="active">Activo</option>
            </select>
          </div>

          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}><LoadingState label="Cargando dispositivos…" /></div>
          ) : filteredDevices.length === 0 ? (
            <EmptyState icon="📟" title="No hay dispositivos" description="No se encontraron elementos con los filtros seleccionados." />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {filteredDevices.map(row => (
                <div key={row.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>#{row.id}</span>
                    <span className="badge">{row.status || '—'}</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{row.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{row.type || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                    <span>IP: <code style={{ color: '#38bdf8' }}>{row.ip_address || '—'}</code></span>
                    <span>Ubicación: {locationMap.get(String(row.location_id)) || 'Sin asignación'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export function DeviceActions() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, notify, clearToast] = useToast();

  const loadActions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, per_page: perPage });
      const res = await apiFetch(`/device_actions?${params.toString()}`);

      if (!res.ok) throw new Error('No se pudo cargar la bitácora');

      const data = await res.json();
      const list = Array.isArray(data) ? data : data.items || [];

      setItems(list);
      setTotal(data.total || list.length);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, perPage, notify]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
              Bitácora de auditoría
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>
              Eventos de seguridad y trazabilidad registrados por el sistema.
            </p>
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading ? (
            <div style={{ padding: '3rem 0', textAlign: 'center' }}><LoadingState label="Cargando registros…" /></div>
          ) : items.length === 0 ? (
            <EmptyState icon="◷" title="No hay eventos en esta página" description="No se registran actividades recientes." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map(row => (
                <div key={row.id} style={{ backgroundColor: '#090d16', border: '1px solid #1e293b', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.0rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '180px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{row.created_at}</span>
                    <span className="badge badge-info" style={{ width: 'fit-content' }}>{row.action_type || 'ACCIÓN'}</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, minWidth: '200px' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#f8fafc' }}>{row.username || row.user_id || 'Anónimo'}</strong>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{row.details || '—'}</span>
                  </div>

                  <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#94a3b8', alignItems: 'center' }}>
                    <span>Rol: <strong style={{ color: '#cbd5e1' }}>{row.user_role || 'Sin rol'}</strong></span>
                    <span>IP: <code style={{ color: '#38bdf8' }}>{row.ip_address || '—'}</code></span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination page={page} perPage={perPage} total={total} onPrev={() => setPage(v => Math.max(1, v - 1))} onNext={() => setPage(v => v + 1)} />
        </div>

      </div>
    </div>
  );
}

// ============================================================
// Appointments - Con Niveles de Prioridad
// ============================================================

// ============================================================
// Appointments - Multi-View Calendar (Month, Week, Day) con Prioridades
// ============================================================

export function PatientsProfile({ patientId, onBack }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('future'); // 'future' | 'past' | 'treatments'

  // Simulating data loading based on the CLINIK patient profile UI
  useEffect(() => {
    // In real implementation, fetch via apiFetch(`/patients/${patientId}`)
    // Using mock data matching the UI style reference
    setPatient({
      id: patientId || 1,
      full_name: 'Kate Prokopchuk',
      phone: '+38 (093) 23 45 678',
      email: 'katepro@gmail.com',
      dob: '23.07.1994',
      address: 'Lviv, Chornovola street, 67',
      registration_date: 'Thursday, May 25',
      allergies: 'Nuts, pollen',
      chronic_diseases: 'Asthma',
      blood_type: 'I+',
      past_illnesses: 'Corona virus',
      future_visits: [
        { id: 101, time: '11.00-12.30', date: '26 Чер 2023', service: 'Treatment and cleaning of canals', doctor: 'Oksana Ma...', status: 'Scheduled' },
        { id: 102, time: '11.00-12.30', date: '27 Лип 2023', service: 'Teeth whitening', doctor: 'Max Oched...', status: 'Scheduled' }
      ],
      past_visits: [],
      files: [
        { name: 'Check Up Result.pdf', size: '123kb' },
        { name: 'Medical Prescriptions.pdf', size: '123kb' },
        { name: 'Check Up Result.pdf', size: '123kb' }
      ],
      notes: [
        { name: 'Note 31.06.23.pdf', size: '' },
        { name: 'Note 23.06.23.pdf', size: '' }
      ]
    });
    setLoading(false);
  }, [patientId]);

  if (loading) {
    return <div style={{ padding: '2rem', color: '#fff', backgroundColor: '#1f1f1f', minHeight: '100vh' }}>Cargando perfil...</div>;
  }

  return (
    <div style={{ padding: '1.5rem', backgroundColor: '#1f1f1f', color: '#f3f2f1', minHeight: '100vh', width: '100%', boxSizing: 'border-box', fontFamily: '"Segoe UI", sans-serif' }}>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .clinik-card {
          background-color: #292929;
          border: 1px solid #333333;
          border-radius: 12px;
          padding: 1.5rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .clinik-btn-primary {
          background-color: #4b6efb;
          border: none;
          color: #ffffff;
          border-radius: 20px;
          padding: 0.5rem 1.25rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .clinik-btn-primary:hover { opacity: 0.9; }
        .clinik-tab {
          background: transparent;
          border: none;
          color: #8c8c8c;
          padding: 0.5rem 0;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          position: relative;
        }
        .clinik-tab.active {
          color: #ffffff;
        }
        .clinik-tab.active::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          right: 0;
          height: 2px;
          background-color: #4b6efb;
          border-radius: 2px;
        }
      `}</style>

      <div style={{ animation: 'fadeIn 0.3s ease-out forwards', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* HEADER BAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#201f1f', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid #333333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {onBack && (
              <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #484644', color: '#fff', borderRadius: '8px', padding: '0.35rem 0.75rem', cursor: 'pointer' }}>
                ← Volver
              </button>
            )}
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#ffffff', margin: 0 }}>Patient profile</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="clinik-btn-primary" style={{ backgroundColor: 'transparent', border: '1px solid #4b6efb', color: '#4b6efb' }}>PRINT</button>
            <button className="clinik-btn-primary">EDIT</button>
          </div>
        </div>

        {/* MAIN GRID LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          
          {/* LEFT COLUMN: Avatar & Contact */}
          <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem' }}>
            <div style={{ width: '100px', height: '100px', borderRadius: '50%', overflow: 'hidden', backgroundColor: '#3a3a3a', border: '2px solid #4b6efb' }}>
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150" alt={patient.full_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>{patient.full_name}</h3>
              <p style={{ fontSize: '0.85rem', color: '#4b6efb', margin: '0 0 0.2rem 0' }}>{patient.phone}</p>
              <p style={{ fontSize: '0.8rem', color: '#8c8c8c', margin: 0 }}>{patient.email}</p>
            </div>
          </div>

          {/* MIDDLE COLUMN: General Information */}
          <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#fff' }}>General information</h4>
              <span style={{ fontSize: '0.8rem', color: '#4b6efb', cursor: 'pointer' }}>✎</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Date of birth:</span>
                <span style={{ fontWeight: 500 }}>{patient.dob}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Address:</span>
                <span style={{ fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{patient.address}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Registration Date:</span>
                <span style={{ fontWeight: 500 }}>{patient.registration_date}</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Anamnesis */}
          <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#fff' }}>Anamnesis</h4>
              <span style={{ fontSize: '0.8rem', color: '#4b6efb', cursor: 'pointer' }}>✎</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Allergies:</span>
                <span style={{ fontWeight: 500 }}>{patient.allergies}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Chronic diseases:</span>
                <span style={{ fontWeight: 500 }}>{patient.chronic_diseases}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Blood type:</span>
                <span style={{ fontWeight: 500 }}>{patient.blood_type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#8c8c8c' }}>Past illnesses or injuries:</span>
                <span style={{ fontWeight: 500 }}>{patient.past_illnesses}</span>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM SECTION: Visits, Files & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* VISITS SECTION */}
          <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '2rem', borderBottom: '1px solid #333' }}>
              <button className={`clinik-tab ${activeTab === 'future' ? 'active' : ''}`} onClick={() => setActiveTab('future')}>
                Future visits ({patient.future_visits.length})
              </button>
              <button className={`clinik-tab ${activeTab === 'past' ? 'active' : ''}`} onClick={() => setActiveTab('past')}>
                Past visits (15)
              </button>
              <button className={`clinik-tab ${activeTab === 'treatments' ? 'active' : ''}`} onClick={() => setActiveTab('treatments')}>
                Planned treatments
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
              {patient.future_visits.map(visit => (
                <div key={visit.id} style={{ backgroundColor: '#201f1f', border: '1px solid #333', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4b6efb', fontWeight: 600 }}>{visit.time}</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{visit.date}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, minWidth: '150px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#8c8c8c' }}>Service:</span>
                    <span style={{ fontSize: '0.85rem' }}>{visit.service}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span style={{ fontSize: '0.75rem', color: '#8c8c8c' }}>Doctor:</span>
                    <span style={{ fontSize: '0.85rem' }}>{visit.doctor}</span>
                  </div>
                  <div>
                    <span style={{ backgroundColor: 'rgba(35, 123, 75, 0.2)', color: '#237b4b', border: '1px solid #237b4b', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600 }}>
                      ● {visit.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FILES & NOTES SECTION */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Files */}
            <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#fff' }}>Files</h4>
                <span style={{ fontSize: '0.75rem', color: '#4b6efb', cursor: 'pointer', fontWeight: 600 }}>DOWNLOAD</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {patient.files.map((file, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#201f1f', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📄 {file.name}</span>
                    <span style={{ color: '#8c8c8c' }}>{file.size}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="clinik-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0, color: '#fff' }}>Notes</h4>
                <span style={{ fontSize: '0.75rem', color: '#4b6efb', cursor: 'pointer', fontWeight: 600 }}>DOWNLOAD</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {patient.notes.map((note, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#201f1f', padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>📝 {note.name}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

export function Documents() {
  const [documents, setDocuments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [saving, setSaving] = useState(false);
  const [toast, notify, clearToast] = useToast();
  const { user, token } = useAuth(); // Asegúrate de extraer el token si tu auth provider lo provee

  // Almacén de Plantillas sincronizado con la base de datos
  const [templates, setTemplates] = useState([]);

  const [templateName, setTemplateName] = useState('');
  const [templateRows, setTemplateRows] = useState([
    [
      { id_campo: `f_${Date.now()}_1`, nombre_campo: 'Campo 1', tipo_campo: 'texto', validaciones: {}, width: '220px', role: 'input', color: 'dark' },
      { id_campo: `f_${Date.now()}_2`, nombre_campo: 'Campo 2', tipo_campo: 'texto', validaciones: {}, width: '220px', role: 'input', color: 'muted' }
    ]
  ]);

  // Formulario para registrar la atención
  const [form, setForm] = useState({ patient_id: '', document_type: 'ingreso', template_id: '', description: '', dynamicValues: {} });

  // Estado para el redimensionamiento dinámico con ratón (Resize)
  const [resizing, setResizing] = useState(null);

  // Cargar documentos generales
  const loadDocuments = useCallback(async () => {
    try {
      const res = await apiFetch('/documents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setDocuments(await res.json() || []);
    } catch (error) {
      notify('Error al cargar documentos', 'error');
    }
  }, [notify, token]);

  // Cargar plantillas desde el backend de Flask (/api/templates)
  const loadTemplates = useCallback(async () => {
    try {
      const res = await apiFetch('/templates', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (error) {
      notify('Error al cargar plantillas desde la base de datos', 'error');
    }
  }, [notify, token]);

  useEffect(() => {
    loadDocuments();
    loadTemplates();
  }, [loadDocuments, loadTemplates]);

  // ==========================================
  // GESTIÓN DE FILAS Y CELDAS (ESTILO EXCEL)
  // ==========================================
  const addRow = () => {
    setTemplateRows(prev => [
      ...prev,
      [
        { id_campo: `f_${Date.now()}_1`, nombre_campo: 'Nuevo Campo', tipo_campo: 'texto', validaciones: {}, width: '220px', role: 'input', color: 'muted' }
      ]
    ]);
  };

  const addCellToRow = (rIdx) => {
    setTemplateRows(prev => {
      const copy = prev.map(row => row.map(cell => ({ ...cell })));
      if (copy[rIdx].length >= 5) {
        notify('Máximo 5 celdas permitidas por fila para mantener el orden visual.', 'error');
        return copy;
      }
      copy[rIdx].push({
        id_campo: `f_${Date.now()}_${copy[rIdx].length + 1}`,
        nombre_campo: `Campo ${copy[rIdx].length + 1}`,
        tipo_campo: 'texto',
        validaciones: {},
        width: '200px',
        role: 'input',
        color: 'muted'
      });
      return copy;
    });
  };

  const removeCell = (rIdx, cIdx) => {
    setTemplateRows(prev => {
      const copy = prev.map(row => row.map(cell => ({ ...cell })));
      if (copy[rIdx].length <= 1) {
        notify('La fila debe contener al menos 1 celda. Elimine la fila completa si lo desea.', 'error');
        return copy;
      }
      copy[rIdx].splice(cIdx, 1);
      return copy;
    });
  };

  const removeRow = (rIdx) => {
    if (templateRows.length <= 1) return notify('Debe conservar al menos una fila en la plantilla.', 'error');
    setTemplateRows(prev => prev.filter((_, i) => i !== rIdx));
  };

  const updateCellConfig = (rIdx, cIdx, field, val) => {
    setTemplateRows(prev => {
      const copy = prev.map(row => row.map(cell => ({ ...cell })));
      copy[rIdx][cIdx][field] = val;
      return copy;
    });
  };

  // ==========================================
  // REDIMENSIONAMIENTO DINÁMICO CON RATÓN (DRAG)
  // ==========================================
  const startResizing = (e, rIdx, cIdx) => {
    e.preventDefault();
    const startX = e.clientX;
    const currentCell = templateRows[rIdx][cIdx];
    const currentWidth = parseInt(currentCell.width || '200', 10);

    const onMouseMove = (moveEvent) => {
      const diffX = moveEvent.clientX - startX;
      const newWidth = Math.max(100, currentWidth + diffX);
      setTemplateRows(prev => {
        const copy = prev.map(row => row.map(cell => ({ ...cell })));
        copy[rIdx][cIdx].width = `${newWidth}px`;
        return copy;
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // ==========================================
  // DUPLICAR PLANTILLAS LOCALMENTE O EN DB
  // ==========================================
  const duplicateTemplate = (template) => {
    setTemplateName(`${template.nombre || template.name} (Copia)`);
    // Carga la estructura de la plantilla seleccionada en el grid actual para poder editarla y guardarla como nueva
    if (template.structure) {
      setTemplateRows(template.structure);
    }
    setShowTemplateBuilder(true);
    notify(`Plantilla cargada en el diseñador para duplicar/editar.`, 'success');
  };

  // ==========================================
  // GUARDAR PLANTILLA EN BASE DE DATOS (FLASK/SUPABASE)
  // ==========================================
  const saveTemplate = async (e) => {
    e.preventDefault();
    if (!templateName.trim()) return notify('Asigne un nombre a la plantilla.', 'error');

    const newTemplatePayload = {
      nombre: templateName,
      version: 1,
      structure: templateRows
    };

    try {
      const res = await apiFetch('/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTemplatePayload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al guardar la plantilla');

      notify('Plantilla guardada correctamente en la base de datos.', 'success');
      setTemplateName('');
      setShowTemplateBuilder(false);
      loadTemplates(); // Recarga la lista de plantillas desde la BD
    } catch (error) {
      notify(error.message, 'error');
    }
  };
  // ==========================================
  // ELIMINAR PLANTILLA EN BASE DE DATOS
  // ==========================================
  const deleteTemplate = async (templateId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta plantilla?')) return;

    try {
      const res = await apiFetch(`/templates/${templateId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al eliminar la plantilla');

      notify('Plantilla eliminada correctamente.', 'success');
      loadTemplates(); // Recarga la lista desde la BD
    } catch (error) {
      notify(error.message, 'error');
    }
  };
  // ==========================================
  // ENVÍO DE DATOS (Flujo Paciente / Supabase)
  // ==========================================
  const submitDocument = async (e) => {
    e.preventDefault();
    if (!form.patient_id || !form.template_id) {
      return notify('Complete el Paciente y seleccione una Plantilla.', 'error');
    }
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('patient_id', form.patient_id);
      formData.append('document_type', form.document_type);
      formData.append('template_id', form.template_id);
      formData.append('description', form.description);
      formData.append('dynamicValues', JSON.stringify(form.dynamicValues));

      const res = await apiFetch('/documents/upload-supabase', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error al generar el PDF en el servidor');

      notify('Documento PDF generado y registrado con éxito.', 'success');
      setShowForm(false);
      setForm({ patient_id: '', document_type: 'ingreso', template_id: '', description: '', dynamicValues: {} });
      loadDocuments();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const activeTemplate = templates.find(t => String(t.id) === String(form.template_id));

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Gestión de Formularios y Plantillas</h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem' }}>Control estricto de campos dinámicos, flujos de pacientes y plantillas reutilizables.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#38bdf8', borderRadius: '12px', padding: '0.5rem 1rem', cursor: 'pointer' }} onClick={() => setShowTemplateBuilder(v => !v)}>
              {showTemplateBuilder ? 'Cerrar Diseñador' : '⚙️ Diseñador de Plantillas (Grid Libre)'}
            </button>
            <button style={{ backgroundColor: '#3b82f6', border: 'none', color: '#fff', borderRadius: '12px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowForm(v => !v)}>
              {showForm ? 'Cancelar' : '＋ Asignar Formulario a Paciente'}
            </button>
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        {/* LISTADO DE TEMPLATES CON OPCIÓN DE DUPLICAR Y ELIMINAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1rem', color: '#94a3b8', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Plantillas Disponibles en Base de Datos (Templates)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            {templates.map(tpl => (
              <div key={tpl.id} style={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 0.3rem 0', color: '#f8fafc', fontSize: '1rem' }}>{tpl.nombre || tpl.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>Versión {tpl.version}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => duplicateTemplate(tpl)}
                    title="Copiar / Duplicar Plantilla"
                    style={{ background: '#1e293b', border: '1px solid #475569', color: '#cbd5e1', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    📋
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    title="Eliminar Plantilla"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.4rem 0.75rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================== */}
        {/* DISEÑADOR ESTILO EXCEL (FILAS Y CELDAS LIBRES) */}
        {/* ========================================== */}
        {showTemplateBuilder && (
          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid #3b82f6', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: 0 }}>Constructor de Formularios (Grid Estilo Excel)</h3>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>Configure filas independientes (hasta 5 celdas por fila). Arrastre el borde derecho de cada celda para modificar su ancho de manera dinámica.</p>

            <input
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '10px', padding: '0.6rem 1rem', outline: 'none' }}
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="Nombre del nuevo template (ej. Ficha de Evolución Diaria)"
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem' }}>
              {templateRows.map((row, rIdx) => (
                <div key={rIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#090d16', padding: '0.75rem', borderRadius: '12px', border: '1px dashed #334155' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 'bold', minWidth: '50px' }}>Fila {rIdx + 1}</span>

                  {row.map((cell, cIdx) => (
                    <div
                      key={cIdx}
                      style={{
                        position: 'relative',
                        width: cell.width,
                        minWidth: '100px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.35rem',
                        resize: 'horizontal'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                          style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', outline: 'none' }}
                          value={cell.nombre_campo}
                          onChange={e => updateCellConfig(rIdx, cIdx, 'nombre_campo', e.target.value)}
                          placeholder="Etiqueta"
                        />
                        <button onClick={() => removeCell(rIdx, cIdx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }} title="Eliminar celda">×</button>
                      </div>

                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <select style={{ background: '#0f172a', color: '#38bdf8', fontSize: '0.65rem', border: 'none', borderRadius: '4px', padding: '0.1rem' }} value={cell.tipo_campo} onChange={e => updateCellConfig(rIdx, cIdx, 'tipo_campo', e.target.value)}>
                          <option value="texto">Texto</option>
                          <option value="número">Número</option>
                          <option value="fecha">Fecha</option>
                          <option value="archivo">Archivo</option>
                        </select>
                      </div>

                      <div
                        onMouseDown={(e) => startResizing(e, rIdx, cIdx)}
                        title="Arrastre para cambiar ancho"
                        style={{ position: 'absolute', right: 0, top: 0, bottom: '0', width: '6px', cursor: 'col-resize', backgroundColor: 'rgba(56, 189, 248, 0.3)', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                      />
                    </div>
                  ))}

                  {row.length < 5 && (
                    <button onClick={() => addCellToRow(rIdx)} style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid #334155', borderRadius: '8px', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem' }} title="Agregar celda en esta fila (Máx 5)">
                      + Columna
                    </button>
                  )}

                  <button onClick={() => removeRow(rIdx)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', marginLeft: 'auto' }}>
                    Eliminar Fila
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #334155' }}>
              <button onClick={addRow} style={{ background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>＋ Agregar Nueva Fila</button>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowTemplateBuilder(false)} style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={saveTemplate} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '0.5rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Guardar Plantilla en DB</button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* FORMULARIO DE ASIGNACIÓN A PACIENTE */}
        {/* ========================================== */}
        {showForm && (
          <form onSubmit={submitDocument} style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#f8fafc', margin: 0 }}>Rellenar Formulario Clínico para Paciente</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <input required style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.6rem', borderRadius: '8px', outline: 'none' }} value={form.patient_id} onChange={e => setForm(p => ({ ...p, patient_id: e.target.value }))} placeholder="ID Paciente (FK)" />

              <select style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.6rem', borderRadius: '8px', outline: 'none' }} value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}>
                <option value="ingreso">Ingreso</option>
                <option value="evolución">Evolución</option>
                <option value="alta">Alta</option>
              </select>

              <select required style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.6rem', borderRadius: '8px', outline: 'none' }} value={form.template_id} onChange={e => setForm(p => ({ ...p, template_id: e.target.value, dynamicValues: {} }))}>
                <option value="">Seleccione Plantilla (Template)</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.nombre || t.name}</option>)}
              </select>
            </div>

            {activeTemplate && activeTemplate.structure && (
              <div style={{ background: '#090d16', border: '1px solid #334155', borderRadius: '12px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#38bdf8' }}>Campos del formulario: {activeTemplate.nombre || activeTemplate.name}</h4>

                {activeTemplate.structure.map((row, rIdx) => (
                  <div key={rIdx} style={{ display: 'grid', gridTemplateColumns: `repeat(${row.length}, 1fr)`, gap: '1rem' }}>
                    {row.map((cell, cIdx) => {
                      const key = `${rIdx}-${cIdx}`;
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{cell.nombre_campo} ({cell.tipo_campo})</label>
                          <input
                            type={cell.tipo_campo === 'número' ? 'number' : cell.tipo_campo === 'fecha' ? 'date' : 'text'}
                            style={{ background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '6px', outline: 'none' }}
                            value={form.dynamicValues[key] || ''}
                            onChange={e => setForm(p => ({ ...p, dynamicValues: { ...p.dynamicValues, [key]: e.target.value } }))}
                            placeholder={`Escribir ${cell.nombre_campo}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button type="submit" disabled={saving || !form.template_id} style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                {saving ? 'Guardando en Base de Datos...' : 'Registrar y Generar PDF'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

// ============================================================
// Reports + Dashboard (Con funciones de exportación)
// ============================================================

export function Reports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, notify, clearToast] = useToast()

  useEffect(() => {
    ; (async () => {
      try {
        const res = await apiFetch('/reports')
        if (!res.ok) throw new Error('No se pudo cargar el reporte')
        setData(await res.json())
      } catch (error) { notify(error.message, 'error') } finally { setLoading(false) }
    })()
  }, [notify])

  return (
    <PageShell title="Reportes operativos" subtitle="Indicadores resumidos para supervisar la operación diaria.">
      <Toast toast={toast} onClose={clearToast} />
      <SectionCard title="Resumen ejecutivo" icon="▥">
        {loading ? <LoadingState /> : data ? <div className="stats-grid"><StatCard icon="👥" label="Pacientes" value={data.summary?.patients ?? 0} /><StatCard icon="🩺" label="Consultas" value={data.summary?.consultations ?? 0} tone="success" /><StatCard icon="◷" label="Citas" value={data.summary?.appointments ?? 0} tone="primary" /><StatCard icon="⚠" label="Alertas activas" value={data.summary?.active_alerts ?? 0} tone={data.summary?.active_alerts ? 'danger' : 'success'} /></div> : <EmptyState title="No hay información disponible" />}
      </SectionCard>
    </PageShell>
  )
}

// ============================================================
// Dashboard (Con exportación profesional y limpia para PDF)
// ============================================================

export function Dashboard() {
  const [reports, setReports] = useState(null)
  const [series, setSeries] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [areas, setAreas] = useState([])
  const [days, setDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [toast, notify, clearToast] = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [reportsRes, seriesRes, metricsRes, areasRes] = await Promise.all([
        apiFetch('/reports'),
        apiFetch(`/reports/series?days=${days}`),
        apiFetch('/metrics'),
        apiFetch('/dashboard/areas'),
      ])
      if (!reportsRes.ok || !seriesRes.ok || !metricsRes.ok || !areasRes.ok) throw new Error('No se pudieron actualizar todos los indicadores')
      setReports(await reportsRes.json())
      setSeries(await seriesRes.json() || [])
      setMetrics(await metricsRes.json())
      setAreas(await areasRes.json() || [])
    } catch (error) { notify(error.message, 'error') } finally { setLoading(false) }
  }, [days, notify])

  useEffect(() => { load() }, [load])

  // ============================================================
  // FUNCIONES DE EXPORTACIÓN
  // ============================================================

  // 1. Exportar a JSON (Se mantiene limpio y directo en el cliente)
  const exportJSON = () => {
    try {
      const exportData = { reports, series, metrics, areas, exportedAt: new Date().toISOString() }
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard_report_${days}d.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      notify('Exportado a JSON exitosamente', 'success')
    } catch (e) {
      notify('Error al exportar en JSON', 'error')
    }
  }

  // 2. Exportar a CSV mejorado con soporte para tildes (UTF-8 BOM)
  const exportCSV = () => {
    try {
      let csvContent = "\uFEFFDía,Pacientes,Consultas\n"; // \uFEFF asegura que Excel reconozca tildes y caracteres en español
      series.forEach(row => {
        csvContent += `"${row.day}","${row.patients}","${row.consultations}"\n`;
      })
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `tendencia_pacientes_${days}d.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      notify('Exportado a CSV exitosamente', 'success')
    } catch (e) {
      notify('Error al exportar en CSV', 'error')
    }
  }

  // 3. Exportar a Excel (XLSX) profesional consumiendo el endpoint del Dashboard
  const exportExcel = async () => {
    try {
      // Recuperar el token del localStorage (o de donde lo guardes al iniciar sesión)
      const currentToken = localStorage.getItem('token') || '';

      const res = await apiFetch('/dashboard/export/excel', {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        }
      });

      if (!res.ok) throw new Error('Error al generar el archivo Excel en el servidor');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard_reporte_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify('Archivo Excel (XLSX) del dashboard generado correctamente', 'success');
    } catch (e) {
      notify(e.message || 'Error al exportar a Excel', 'error');
    }
  };


  // MÉTODO PROFESIONAL PARA PDF: Inyecta estilos temporales de paginación y diseño corporativo
  const exportPDF = () => {
    try {
      const styleId = 'pdf-print-styles';
      let styleElement = document.getElementById(styleId);

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      // Reglas CSS estrictas para impresión: Evita cortes en cajas, fuerza fondo blanco corporativo y oculta controles interactivos
      styleElement.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-dashboard, #printable-dashboard * {
            visibility: visible;
          }
          #printable-dashboard {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            padding: 1rem !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            background-color: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            margin-bottom: 1.5rem !important;
            box-shadow: none !important;
          }
        }
      `;

      window.print();
      notify('Reporte PDF listo para guardar o imprimir', 'success');
    } catch (e) {
      notify('Error al preparar el reporte PDF', 'error');
    }
  };

  return (
    <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }}>

      {/* MARCO GENERAL ESTILO DOCUMENTO (ID añadido para control de impresión limpio) */}
      <div id="printable-dashboard" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* CABECERA Y FILTROS */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>Dashboard Gerencial</h1>
            <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.35rem', marginBottom: 0 }}>Visión rápida del desempeño clínico y operativo en tiempo real.</p>
          </div>

          <div className="no-print" style={{ display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Día(s)</label>
              <select
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, outline: 'none', cursor: 'pointer' }}
                value={days}
                onChange={e => setDays(Number(e.target.value))}
              >
                <option value={7}>Últimos 7 días</option>
                <option value={14}>Últimos 14 días</option>
                <option value={30}>Últimos 30 días</option>
              </select>
            </div>

            {/* BOTONES DE EXPORTACIÓN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exportar</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button title="Exportar a CSV" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#38bdf8', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} onClick={exportCSV}>CSV</button>
                <button title="Exportar a Excel" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#34d399', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} onClick={exportExcel}>Excel</button>
                <button title="Exportar a PDF" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f87171', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} onClick={exportPDF}>PDF</button>
                <button title="Exportar a JSON" style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fbbf24', borderRadius: '10px', padding: '0.5rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }} onClick={exportJSON}>JSON</button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 600, color: 'transparent', textTransform: 'uppercase' }}>&nbsp;</label>
              <button
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={load}
                disabled={loading}
              >
                <span className={cx(loading && "animate-spin")}>↻</span> Actualizar
              </button>
            </div>
          </div>
        </div>

        <Toast toast={toast} onClose={clearToast} />

        {loading ? (
          <div style={{ padding: '4rem 0', textAlign: 'center' }}><LoadingState label="Actualizando indicadores del sistema…" /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', width: '100%' }}>

            {/* GRILLA DE KPI */}
            <div className="print-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem', width: '100%' }}>
              <StatCard icon={<StatIcons.Patients />} label="Pacientes" value={reports?.summary?.patients ?? 0} hint="Total registrado" tone="primary" />
              <StatCard icon={<StatIcons.Consultations />} label="Consultas" value={reports?.summary?.consultations ?? 0} hint={`Últimos ${days} días`} tone="success" />
              <StatCard icon={<StatIcons.Users />} label="Usuarios activos" value={metrics?.active_users ?? 0} hint="Sesiones recientes" tone="primary" />
              <StatCard icon={<StatIcons.Time />} label="Sesión promedio" value={`${Math.round(metrics?.avg_session_seconds || 0)}s`} hint="Duración media" tone="warning" />
              <StatCard icon={<StatIcons.Time />} label="Próxima sesión" value="0s" hint="Predicción" tone="primary" />
            </div>

            {/* GRILLA INFERIOR DE GRÁFICOS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.5rem', width: '100%', paddingTop: '0.5rem' }}>

              <div className="print-card" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Tendencia de pacientes / consultas</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Evolución diaria de atención</p>
                </div>
                <div style={{ paddingTop: '0.5rem' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} stroke="#64748b" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} />
                      <Line type="monotone" dataKey="patients" stroke="#3b82f6" strokeWidth={3} dot={false} name="Pacientes" />
                      <Line type="monotone" dataKey="consultations" stroke="#10b981" strokeWidth={3} dot={false} name="Consultas" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="print-card" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Dispositivos y alertas por área</h3>
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Distribución operativa del sistema</p>
                </div>
                <div style={{ paddingTop: '0.5rem' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={areas} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
                      <YAxis allowDecimals={false} stroke="#64748b" tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} />
                      <Bar dataKey="device_count" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Dispositivos" />
                      <Bar dataKey="active_alerts" fill="#ef4444" radius={[6, 6, 0, 0]} name="Alertas activas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  )
}

export function Users() {
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [toast, notify, clearToast] = useToast()
  const debouncedSearch = useDebouncedValue(search)

  const [viewMode, setViewMode] = useState('list')
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({ username: '', email: '', role: 'admin', location_id: '', password: '' })
  const [submitting, setSubmitting] = useState(false)

  const [deleteModalUser, setDeleteModalUser] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, lRes] = await Promise.all([apiFetch('/users'), apiFetch('/locations')])
      if (!uRes.ok || !lRes.ok) throw new Error('No se pudo cargar la administración de usuarios')
      setUsers(await uRes.json() || [])
      setLocations(await lRes.json() || [])
    } catch (error) { notify(error.message, 'error') } finally { setLoading(false) }
  }, [notify])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    return users.filter(user => !q || [user.username, user.email, user.role].filter(Boolean).some(v => String(v).toLowerCase().includes(q)))
  }, [users, debouncedSearch])

  const locationMap = useMemo(() => new Map(locations.map(l => [String(l.id), l.name])), [locations])

  const roleConfig = {
    admin: { bg: 'bg-red-500/10 text-red-400 border-red-500/20', Icon: Shield, label: 'Admin' },
    doctor: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', Icon: Stethoscope, label: 'Doctor' },
    nurse: { bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', Icon: UserCheck, label: 'Enfermera(o)' },
    user: { bg: 'bg-slate-800 text-slate-300 border-slate-700', Icon: User, label: 'Usuario' }
  }

  const handleOpenCreate = () => {
    setEditingUser(null)
    setFormData({ username: '', email: '', role: 'admin', location_id: '', password: '' })
    setViewMode('form')
  }

  const handleOpenEdit = (user) => {
    setEditingUser(user)
    setFormData({
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'admin',
      location_id: user.location_id || '',
      password: ''
    })
    setViewMode('form')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const endpoint = editingUser ? `/users/${editingUser.id}` : '/users'
      const method = editingUser ? 'PUT' : 'POST'

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (!res.ok) throw new Error('Error al guardar el usuario')

      notify(editingUser ? 'Usuario actualizado exitosamente' : 'Usuario creado exitosamente', 'success')
      setViewMode('list')
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteModalUser) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/users/${deleteModalUser.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar el usuario')
      notify('Usuario eliminado correctamente', 'success')
      setDeleteModalUser(null)
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (viewMode === 'form') {
    return (
      <div style={{ padding: '2.5rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', width: '100%', boxSizing: 'border-box' }} className="animate-fadeIn">
        <Toast toast={toast} onClose={clearToast} />

        <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', border: '1px solid #1e293b', borderRadius: '24px', padding: '2rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)', display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '56rem', margin: '0 auto' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em', color: '#818cf8', textTransform: 'uppercase', backgroundColor: 'rgba(99, 102, 241, 0.1)', borderRadius: '9999px', border: '1px solid rgba(99, 102, 241, 0.2)', width: 'fit-content' }}>
                <Shield style={{ width: '0.875rem', height: '0.875rem' }} />
                {editingUser ? `ID de Cuenta: #${editingUser.id}` : 'Alta de Cuenta'}
              </span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0, letterSpacing: '-0.025em' }}>
                {editingUser ? 'Editar Cuenta de Usuario' : 'Registrar Nuevo Usuario'}
              </h1>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginTop: '0.15rem', marginBottom: 0 }}>
                {editingUser ? 'Modifica los parámetros de acceso y privilegios en la plataforma.' : 'Ingresa la información necesaria para dar de alta el perfil.'}
              </p>
            </div>

            <div>
              <button
                type="button"
                style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => setViewMode('list')}
              >
                ← Volver al listado
              </button>
            </div>
          </div>

          <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>Información de la cuenta</h3>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>Los campos marcados con * son obligatorios.</p>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                    <User style={{ width: '1rem', height: '1rem', color: '#818cf8' }} />
                    Nombre de Usuario *
                  </label>
                  <input
                    type="text"
                    required
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    placeholder="ej. jperez"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                    <Mail style={{ width: '1rem', height: '1rem', color: '#818cf8' }} />
                    Correo Electrónico *
                  </label>
                  <input
                    type="email"
                    required
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="correo@institucion.com"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                    <Shield style={{ width: '1rem', height: '1rem', color: '#818cf8' }} />
                    Rol Asignado *
                  </label>
                  <select
                    required
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="admin">Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Enfermera(o)</option>
                    <option value="user">Usuario</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                    <MapPin style={{ width: '1rem', height: '1rem', color: '#818cf8' }} />
                    Área / Ubicación
                  </label>
                  <select
                    style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none', cursor: 'pointer' }}
                    value={formData.location_id}
                    onChange={e => setFormData({ ...formData, location_id: e.target.value })}
                  >
                    <option value="">Sin asignación</option>
                    {locations.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingTop: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', fontWeight: 500, color: '#94a3b8' }}>
                  <Key style={{ width: '1rem', height: '1rem', color: '#818cf8' }} />
                  {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso *'}
                </label>
                <input
                  type="password"
                  {...(!editingUser ? { required: true } : {})}
                  style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', outline: 'none' }}
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? "Dejar en blanco para mantener la actual" : "••••••••"}
                />
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', marginBottom: 0 }}>
                  {editingUser ? 'Deja este campo vacío si no requieres actualizar la clave actual.' : 'Se recomienda una clave alfanumérica segura.'}
                </p>
              </div>

              <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '0.5rem 0' }} />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}
                  onClick={() => setViewMode('list')}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#3b82f6', border: 'none', color: '#ffffff', borderRadius: '12px', padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}
                  disabled={submitting}
                >
                  {submitting ? 'Guardando…' : (editingUser ? 'Actualizar Usuario' : 'Crear Usuario')}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    )
  }

  return (
    <div className="page-shell animate-fadeIn">
      <Toast toast={toast} onClose={clearToast} />

      <div className="card collection-card">
        <div className="collection-header">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Directorio de Usuarios</h2>
            <p className="text-sm text-slate-400 mt-0.5">{filtered.length} cuentas registradas en el sistema.</p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn btn-primary flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            <span>Nuevo Usuario</span>
          </button>
        </div>

        <div className="collection-toolbar pt-2">
          <div className="collection-search" style={{ flex: '1' }}>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por usuario, correo o rol..."
              className="form-control transition-all focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            <span className="text-sm">Cargando registros...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table-container">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo Electrónico</th>
                  <th>Rol Asignado</th>
                  <th>Área / Ubicación</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-12 text-slate-500 italic">
                      No se encontraron usuarios registrados
                    </td>
                  </tr>
                ) : (
                  filtered.map(u => {
                    const roleKey = String(u.role || 'user').toLowerCase()
                    const config = roleConfig[roleKey] || roleConfig.user
                    const RoleIcon = config.Icon
                    const area = locationMap.get(String(u.location_id))

                    return (
                      <tr key={u.id} className="transition-all duration-150 hover:bg-slate-800/40 group">
                        <td>
                          <div className="flex items-center gap-3 py-2">
                            <div className="avatar-circle shrink-0 text-white shadow-sm font-semibold transition-transform duration-200 group-hover:scale-110">
                              {u.username ? u.username.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <strong className="text-white block truncate max-w-xs">{u.username}</strong>
                              <span className="text-xs text-slate-400">ID: #{u.id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-slate-300 text-sm truncate block max-w-xs">{u.email || '—'}</span>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-transform duration-200 hover:scale-105 ${config.bg}`}>
                            <RoleIcon className="w-3.5 h-3.5" />
                            <span className="capitalize">{config.label}</span>
                          </span>
                        </td>
                        <td>
                          {area ? (
                            <span className="text-slate-200 text-sm font-medium">{area}</span>
                          ) : (
                            <span className="text-slate-500 text-sm italic">Sin asignación</span>
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-4">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              className="btn btn-secondary px-3.5 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all duration-200 hover:scale-105 hover:bg-slate-800 active:scale-95"
                              title="Editar usuario"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-300" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteModalUser(u)}
                              className="btn px-3.5 py-1.5 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center gap-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                              title="Eliminar usuario"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-white p-8 space-y-6 transform animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto shadow-inner animate-bounce">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-bold text-xl text-white">¿Eliminar usuario?</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Estás a punto de eliminar permanentemente a <span className="text-slate-200 font-semibold">{deleteModalUser.username}</span>. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="btn btn-secondary flex-1 py-3 transition-all duration-200 hover:bg-slate-800 active:scale-95"
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="btn flex-1 bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25 disabled:opacity-50 py-3 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Eliminando...</span>
                  </span>
                ) : (
                  <span>Sí, eliminar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


export function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, notify, clearToast] = useToast()

  useEffect(() => {
    ; (async () => {
      try {
        const res = await apiFetch('/profile')
        if (!res.ok) throw new Error('No se pudo cargar el perfil')
        setProfile(await res.json())
      } catch (error) { notify(error.message, 'error') } finally { setLoading(false) }
    })()
  }, [notify])

  return <PageShell title="Mi perfil" subtitle="Resumen de identidad y actividad dentro del sistema."><Toast toast={toast} onClose={clearToast} />{loading ? <SectionCard><LoadingState label="Cargando perfil…" /></SectionCard> : profile ? <><SectionCard title="Información de cuenta" icon="◎"><div className="profile-hero"><div className="profile-avatar">{(profile.username || user?.email || 'U').charAt(0).toUpperCase()}</div><div><div className="card-kicker">Usuario</div><h2>{profile.username}</h2><span className="badge badge-info">{profile.role_name || profile.role}</span></div></div><div className="profile-grid"><div><span className="meta-label">Rol</span><strong>{profile.role_name || profile.role}</strong></div><div><span className="meta-label">Tenant</span><strong>#{profile.tenant_id}</strong></div><div><span className="meta-label">Alta</span><strong>{formatDate(profile.created_at)}</strong></div><div><span className="meta-label">Permisos</span><strong>{profile.permissions?.length ?? 0}</strong></div></div></SectionCard><div className="stats-grid"><StatCard icon="👥" label="Pacientes" value={profile.counts?.patients ?? 0} /><StatCard icon="🩺" label="Consultas" value={profile.counts?.consultations ?? 0} tone="success" /><StatCard icon="◷" label="Citas" value={profile.counts?.appointments ?? 0} tone="primary" /><StatCard icon="▤" label="Documentos" value={profile.counts?.documents ?? 0} tone="warning" /></div></> : <SectionCard><EmptyState title="No se pudo cargar el perfil" /></SectionCard>}</PageShell>
}

export { calculateBMI, parseBrowser }
