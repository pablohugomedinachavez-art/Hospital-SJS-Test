import React, { useState } from 'react';
import { FaTimes, FaUserPlus, FaBed } from 'react-icons/fa';

export default function AdmissionModal({ bed, onClose, onSuccess }) {
  const [patientId, setPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAdmission = async (e) => {
    e.preventDefault();
    if (!patientId) {
      setError('Por favor, ingresa el ID del paciente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ipd/admission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_id: parseInt(patientId),
          bed_id: bed.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar la admisión');
      }

      onSuccess(); // Actualiza el dashboard de camas
      onClose();   // Cierra el modal
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#131B2E] border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl text-slate-100">
        
        {/* Cabecera */}
        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FaUserPlus />
            </div>
            <h2 className="text-lg font-bold">Admisión de Paciente</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer"
          >
            <FaTimes />
          </button>
        </div>

        {/* Información de la cama seleccionada */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-3.5 mb-5 flex items-center gap-3">
          <FaBed className="text-blue-400 text-xl" />
          <div>
            <p className="text-xs text-slate-400">{bed.wing}</p>
            <p className="text-sm font-semibold text-white">Habitación / Cama: {bed.room}</p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleAdmission} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              ID de Paciente (Historia Clínica)
            </label>
            <input 
              type="number" 
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Ej. 12"
              className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-emerald-500 transition"
              required
            />
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Admisión'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}