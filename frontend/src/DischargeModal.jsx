import React, { useState } from 'react';
import { FaTimes, FaSignOutAlt, FaCheckCircle } from 'react-icons/fa';

export default function DischargeModal({ bed, onClose, onSuccess }) {
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDischarge = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ipd/discharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          bed_id: bed.id,
          patient_id: bed.patient?.id,
          notes: dischargeNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar el alta');
      }

      onSuccess();
      onClose();
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
            <div className="p-2 bg-rose-500/20 text-rose-400 rounded-lg">
              <FaSignOutAlt />
            </div>
            <h2 className="text-lg font-bold">Procesar Alta Hospitalaria</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
            <FaTimes />
          </button>
        </div>

        {/* Resumen de Cama y Paciente */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-3.5 mb-4 space-y-1.5">
          <p className="text-xs text-slate-400">Paciente: <strong className="text-white">{bed.patient?.name || 'N/A'}</strong></p>
          <p className="text-xs text-slate-400">Ubicación: <strong className="text-slate-200">{bed.wing} - Hab. {bed.room}</strong></p>
          <p className="text-xs text-slate-400">Fecha de Ingreso: <strong className="text-slate-200">{bed.patient?.admission_date || 'N/A'}</strong></p>
        </div>

        <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3 mb-4">
          <p className="text-xs text-amber-300 italic">
            ⚠️ Al confirmar el alta, la cama quedará libre y pasará a mantenimiento/limpieza preventiva de bioseguridad.
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleDischarge} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Notas de Egreso / Diagnóstico Final
            </label>
            <textarea
              value={dischargeNotes}
              onChange={(e) => setDischargeNotes(e.target.value)}
              placeholder="Ej. Paciente recuperado satisfactoriamente. Se indica tratamiento ambulatorio..."
              rows="3"
              className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-rose-500 transition resize-none"
              required
            ></textarea>
          </div>

          {error && (
            <div className="bg-rose-950/40 border border-rose-900/50 text-rose-300 text-xs p-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Botones */}
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
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-rose-900/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Alta'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}   