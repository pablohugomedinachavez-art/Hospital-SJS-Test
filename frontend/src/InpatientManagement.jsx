import React, { useState, useEffect } from 'react';
import { FaBed, FaUserInjured, FaExchangeAlt, FaSignOutAlt, FaPlusCircle, FaTools, FaFilter } from 'react-icons/fa';

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