import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from './api.js';
import { useToast, Toast, LoadingState, EmptyState } from './hospitalModules';
import { Bed, UserPlus, ArrowRightLeft, LogOut, ShieldAlert, CheckCircle2, Clock, Filter, Layers, X, Plus } from 'lucide-react';
import { FaBed, FaUserInjured, FaExchangeAlt, FaSignOutAlt, FaPlusCircle, FaTools, FaFilter } from 'react-icons/fa';

export function InpatientManagement() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedWing, setSelectedWing] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Estados para modales ADT
  const [activeModal, setActiveModal] = useState(null); // 'admit' | 'transfer' | 'discharge'
  const [selectedBed, setSelectedBed] = useState(null);
  const [toast, notify, clearToast] = useToast();

  // Datos de formulario ADT
  const [adtForm, setAdtForm] = useState({
    patient_id: '',
    target_bed_id: '',
    discharge_notes: ''
  });

  // Cargar mapa de camas (simulado / conectado a API)
  const loadBedOccupancy = useCallback(async () => {
    setLoading(true);
    try {
      // Endpoint sugerido para gestión de camas
      const res = await apiFetch('/ipd/beds');
      if (res.ok) {
        const data = await res.json();
        setBeds(Array.isArray(data) ? data : []);
      } else {
        // Datos de respaldo / demo si el endpoint está en desarrollo
        setBeds([
          { id: 101, wing: 'Ala Norte - Piso 1', room: '101-A', status: 'available', patient: null },
          { id: 102, wing: 'Ala Norte - Piso 1', room: '101-B', status: 'occupied', patient: { id: 12, name: 'Juan Pérez', admission_date: '2026-10-10' } },
          { id: 103, wing: 'Ala Sur - Piso 2', room: '202-A', status: 'maintenance', patient: null },
          { id: 104, wing: 'UCI - Piso 3', room: 'UCI-01', status: 'occupied', patient: { id: 15, name: 'María Gómez', admission_date: '2026-10-12' } },
        ]);
      }
    } catch (err) {
      notify('Error al cargar la ocupación de camas', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadBedOccupancy();
  }, [loadBedOccupancy]);

  const handleOpenModal = (type, bed = null) => {
    setActiveModal(type);
    setSelectedBed(bed);
    setAdtForm({ patient_id: '', target_bed_id: '', discharge_notes: '' });
  };

  const handleExecuteADT = async (e) => {
    e.preventDefault();
    try {
      let endpoint = '';
      let payload = {};

      if (activeModal === 'admit') {
        endpoint = '/ipd/admission';
        payload = { patient_id: adtForm.patient_id, bed_id: selectedBed.id };
      } else if (activeModal === 'transfer') {
        endpoint = '/ipd/transfer';
        payload = { patient_id: selectedBed.patient.id, from_bed_id: selectedBed.id, to_bed_id: adtForm.target_bed_id };
      } else if (activeModal === 'discharge') {
        endpoint = '/ipd/discharge';
        payload = { bed_id: selectedBed.id, notes: adtForm.discharge_notes };
      }

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('No se pudo procesar la solicitud ADT');

      notify(`Proceso de ${activeModal} ejecutado con éxito`, 'success');
      setActiveModal(null);
      loadBedOccupancy();
    } catch (err) {
      notify(err.message || 'Error en operación ADT', 'error');
    }
  };

  const filteredBeds = beds.filter(bed => {
    const matchesWing = selectedWing === 'all' || bed.wing === selectedWing;
    const matchesStatus = selectedStatus === 'all' || bed.status === selectedStatus;
    return matchesWing && matchesStatus;
  });

  const wingsList = Array.from(new Set(beds.map(b => b.wing)));

  return (
    <div style={{ padding: '2rem', backgroundColor: '#090d16', color: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <Toast toast={toast} onClose={clearToast} />

      <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '20px', padding: '1.5rem', maxWidth: '1300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '12px', color: '#38bdf8' }}>
              <Bed size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                A. Inpatient Department (IPD) & Bed Management
              </h1>
              <p style={{ fontSize: '0.825rem', color: '#94a3b8', margin: 0 }}>
                Mapeo en tiempo real y flujos ADT (Admisión, Alta y Traslado).
              </p>
            </div>
          </div>

          {/* FILTROS */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <select
              value={selectedWing}
              onChange={e => setSelectedWing(e.target.value)}
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="all">Todas las Alas / Pisos</option>
              {wingsList.map(w => <option key={w} value={w}>{w}</option>)}
            </select>

            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', outline: 'none' }}
            >
              <option value="all">Todos los Estados</option>
              <option value="available">Disponibles</option>
              <option value="occupied">Ocupadas</option>
              <option value="maintenance">Mantenimiento</option>
            </select>
          </div>
        </div>

        {/* MAPA VISUAL DE CAMAS */}
        {loading ? (
          <LoadingState label="Sincronizando mapa de camas..." />
        ) : filteredBeds.length === 0 ? (
          <EmptyState title="Sin camas encontradas" description="No hay registros para los filtros seleccionados." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {filteredBeds.map(bed => {
              const isAvail = bed.status === 'available';
              const isOcc = bed.status === 'occupied';
              const isMaint = bed.status === 'maintenance';

              const statusColor = isAvail ? '#10b981' : isOcc ? '#3b82f6' : '#f59e0b';
              const statusBg = isAvail ? 'rgba(16, 185, 129, 0.1)' : isOcc ? 'rgba(59, 130, 246, 0.1)' : 'rgba(245, 158, 11, 0.1)';

              return (
                <div
                  key={bed.id}
                  style={{
                    backgroundColor: '#0f172a',
                    border: `1px solid ${statusColor}40`,
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>{bed.wing}</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', margin: '0.2rem 0 0 0' }}>Habitación {bed.room}</h3>
                    </div>
                    <span style={{ backgroundColor: statusBg, color: statusColor, border: `1px solid ${statusColor}40`, padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                      {bed.status}
                    </span>
                  </div>

                  {/* INFORMACIÓN DEL PACIENTE */}
                  <div style={{ backgroundColor: '#090d16', padding: '0.75rem', borderRadius: '8px', border: '1px solid #1e293b', fontSize: '0.8rem' }}>
                    {isOcc && bed.patient ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><strong style={{ color: '#94a3b8' }}>Paciente:</strong> <span style={{ color: '#fff', fontWeight: 600 }}>{bed.patient.name}</span></div>
                        <div><strong style={{ color: '#94a3b8' }}>Ingreso:</strong> <span style={{ color: '#cbd5e1' }}>{bed.patient.admission_date}</span></div>
                      </div>
                    ) : isAvail ? (
                      <span style={{ color: '#10b981', fontStyle: 'italic' }}>Cama lista para nueva admisión.</span>
                    ) : (
                      <span style={{ color: '#f59e0b', fontStyle: 'italic' }}>Bloqueada por mantenimiento técnico.</span>
                    )}
                  </div>

                  {/* ACCIONES ADT */}
                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                    {isAvail && (
                      <button
                        onClick={() => handleOpenModal('admit', bed)}
                        style={{ flex: 1, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                      >
                        <UserPlus size={14} /> Admitir
                      </button>
                    )}
                    {isOcc && (
                      <>
                        <button
                          onClick={() => handleOpenModal('transfer', bed)}
                          style={{ flex: 1, backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                          <ArrowRightLeft size={14} /> Trasladar
                        </button>
                        <button
                          onClick={() => handleOpenModal('discharge', bed)}
                          style={{ flex: 1, backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                          <LogOut size={14} /> Alta
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL ADT (ADMISIÓN / TRASLADO / ALTA) */}
      {activeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(4px)', padding: '1rem' }} onClick={() => setActiveModal(null)}>
          <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '450px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#fff', margin: 0, textTransform: 'capitalize' }}>
                Flujo ADT: {activeModal === 'admit' ? 'Admisión de Paciente' : activeModal === 'transfer' ? 'Traslado de Cama' : 'Procesar Alta'}
              </h3>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleExecuteADT} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
              {activeModal === 'admit' && (
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.3rem' }}>ID del Paciente (Ambulatorio / Urgencias)</label>
                  <input
                    required
                    type="number"
                    value={adtForm.patient_id}
                    onChange={e => setAdtForm({ ...adtForm, patient_id: e.target.value })}
                    placeholder="Ej. 1045"
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>Cama asignada: Habitación {selectedBed?.room} ({selectedBed?.wing})</span>
                </div>
              )}

              {activeModal === 'transfer' && (
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.3rem' }}>ID de Cama Destino</label>
                  <input
                    required
                    type="number"
                    value={adtForm.target_bed_id}
                    onChange={e => setAdtForm({ ...adtForm, target_bed_id: e.target.value })}
                    placeholder="Ej. 102"
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.2rem', display: 'block' }}>Paciente actual: {selectedBed?.patient?.name}</span>
                </div>
              )}

              {activeModal === 'discharge' && (
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.3rem' }}>Notas de Alta / Epicrisis</label>
                  <textarea
                    rows={3}
                    value={adtForm.discharge_notes}
                    onChange={e => setAdtForm({ ...adtForm, discharge_notes: e.target.value })}
                    placeholder="Evolución favorable, alta médica autorizada..."
                    style={{ width: '100%', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '0.5rem', borderRadius: '8px', boxSizing: 'border-box' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setActiveModal(null)} style={{ backgroundColor: '#334155', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Cancelar</button>
                <button type="submit" style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Confirmar</button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
}


export default function BedManagement() {
  const [beds, setBeds] = useState([]);
  const [filterWing, setFilterWing] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBeds();
  }, []);

  const fetchBeds = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ipd/beds', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setBeds(data);
    } catch (err) {
      console.error("Error cargando camas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrado dinámico
  const filteredBeds = beds.filter(bed => {
    const matchesWing = filterWing === 'ALL' || bed.wing === filterWing;
    const matchesStatus = filterStatus === 'ALL' || bed.status === filterStatus;
    return matchesWing && matchesStatus;
  });

  // Estadísticas rápidas
  const totalBeds = beds.length;
  const availableBeds = beds.filter(b => b.status === 'available').length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const maintenanceBeds = beds.filter(b => b.status === 'maintenance').length;

  return (
    <div className="p-6 bg-[#0B0F19] min-h-screen text-slate-100 font-sans">
      
      {/* 1. Encabezado principal */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#1E293B]/60 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-md mb-8 gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-400 text-2xl">
            <FaBed />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-white">Inpatient Department (IPD) & Bed Management</h1>
            <p className="text-sm text-slate-400 mt-0.5">Mapeo en tiempo real y flujos ADT (Admisión, Alta y Traslado).</p>
          </div>
        </div>

        {/* Filtros superiores */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-sm">
            <FaFilter className="text-slate-400" />
            <select 
              value={filterWing} 
              onChange={(e) => setFilterWing(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todas las Alas / Pisos</option>
              <option value="Ala Norte - Piso 1">Ala Norte - Piso 1</option>
              <option value="Ala Sur - Piso 2">Ala Sur - Piso 2</option>
              <option value="UCI - Piso 3">UCI - Piso 3</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#0F172A] border border-slate-700 rounded-xl px-3 py-2 text-sm">
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="available">Disponibles</option>
              <option value="occupied">Ocupadas</option>
              <option value="maintenance">Mantenimiento</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Tarjetas de Resumen (KPIs) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#1E293B]/40 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-slate-400 uppercase font-semibold">Total Camas</p>
          <p className="text-2xl font-bold text-white mt-1">{totalBeds}</p>
        </div>
        <div className="bg-[#1E293B]/40 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-emerald-400 uppercase font-semibold">Disponibles</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{availableBeds}</p>
        </div>
        <div className="bg-[#1E293B]/40 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-blue-400 uppercase font-semibold">Ocupadas</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{occupiedBeds}</p>
        </div>
        <div className="bg-[#1E293B]/40 border border-slate-800 p-4 rounded-xl">
          <p className="text-xs text-amber-400 uppercase font-semibold">Mantenimiento</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{maintenanceBeds}</p>
        </div>
      </div>

      {/* 3. Grid de Camas */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando mapa de camas...</div>
      ) : filteredBeds.length === 0 ? (
        <div className="text-center py-12 bg-[#1E293B]/20 border border-slate-800 rounded-2xl text-slate-400">
          No se encontraron camas con los filtros seleccionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBeds.map((bed) => {
            const isAvailable = bed.status === 'available';
            const isOccupied = bed.status === 'occupied';
            const isMaintenance = bed.status === 'maintenance';

            return (
              <div 
                key={bed.id} 
                className={`flex flex-col justify-between bg-[#131B2E] border rounded-2xl p-5 shadow-lg transition-all duration-300 hover:border-slate-600 ${
                  isAvailable ? 'border-emerald-500/30' : isOccupied ? 'border-blue-500/30' : 'border-amber-500/30'
                }`}
              >
                <div>
                  {/* Cabecera de la tarjeta */}
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{bed.wing}</span>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isAvailable ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      isOccupied ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {bed.status}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-4">Habitación {bed.room}</h3>

                  {/* Cuerpo según estado */}
                  {isAvailable && (
                    <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3 mb-4">
                      <p className="text-xs text-emerald-300 italic">Cama lista para nueva admisión.</p>
                    </div>
                  )}

                  {isOccupied && bed.patient && (
                    <div className="bg-[#1E293B]/50 border border-slate-800 rounded-xl p-3 mb-4 space-y-1">
                      <p className="text-xs text-slate-300">
                        <span className="text-slate-400 font-medium">Paciente:</span> <strong className="text-white">{bed.patient.name}</strong>
                      </p>
                      <p className="text-xs text-slate-400">
                        <span>Ingreso:</span> {bed.patient.admission_date}
                      </p>
                    </div>
                  )}

                  {isMaintenance && (
                    <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 mb-4">
                      <p className="text-xs text-amber-300 italic flex items-center gap-1.5">
                        <FaTools /> Bloqueada por mantenimiento técnico.
                      </p>
                    </div>
                  )}
                </div>

                {/* Acciones inferiores ADT */}
                <div className="pt-2">
                  {isAvailable && (
                    <button 
                      onClick={() => alert(`Abrir modal de admisión para cama ${bed.room}`)}
                      className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition shadow-md shadow-emerald-900/20 cursor-pointer"
                    >
                      <FaPlusCircle /> Admitir Paciente
                    </button>
                  )}

                  {isOccupied && (
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => alert(`Trasladar paciente de cama ${bed.room}`)}
                        className="flex items-center justify-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold py-2 px-3 rounded-xl transition shadow-md cursor-pointer"
                      >
                        <FaExchangeAlt /> Trasladar
                      </button>
                      <button 
                        onClick={() => alert(`Procesar alta para cama ${bed.room}`)}
                        className="flex items-center justify-center gap-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold py-2 px-3 rounded-xl transition shadow-md cursor-pointer"
                      >
                        <FaSignOutAlt /> Alta
                      </button>
                    </div>
                  )}

                  {isMaintenance && (
                    <button 
                      disabled
                      className="w-full bg-slate-800 text-slate-500 text-xs font-semibold py-2.5 px-4 rounded-xl cursor-not-allowed"
                    >
                      En Mantenimiento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}