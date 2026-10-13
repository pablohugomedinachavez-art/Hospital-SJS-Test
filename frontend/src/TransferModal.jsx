import React, { useState, useEffect } from 'react';
import { FaTimes, FaExchangeAlt, FaBed } from 'react-icons/fa';

export default function TransferModal({ bed, onClose, onSuccess }) {
  const [availableBeds, setAvailableBeds] = useState([]);
  const [targetBedId, setTargetBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailableBeds();
  }, []);

  const fetchAvailableBeds = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/ipd/beds', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // Filtrar solo camas disponibles que sean diferentes a la actual
      const filtered = data.filter(b => b.status === 'available' && b.id !== bed.id);
      setAvailableBeds(filtered);
    } catch (err) {
      console.error("Error cargando camas disponibles:", err);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!targetBedId) {
      setError('Por favor, selecciona una cama de destino.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/ipd/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patient_id: bed.patient?.id,
          origin_bed_id: bed.id,
          target_bed_id: parseInt(targetBedId),
          notes: notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Error al procesar el traslado');
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
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <FaExchangeAlt />
            </div>
            <h2 className="text-lg font-bold">Traslado de Paciente (ADT)</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition cursor-pointer">
            <FaTimes />
          </button>
        </div>

        {/* Información Actual */}
        <div className="bg-[#1E293B]/60 border border-slate-800 rounded-xl p-3.5 mb-4">
          <p className="text-xs text-slate-400">Paciente Actual:</p>
          <p className="text-sm font-semibold text-white mb-2">{bed.patient?.name || 'Paciente ID: ' + (bed.patient?.id || 'N/A')}</p>
          <p className="text-xs text-slate-400">Ubicación Origen: <span className="text-slate-200">{bed.wing} - Hab. {bed.room}</span></p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleTransfer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Cama / Destino Disponible
            </label>
            <select
              value={targetBedId}
              onChange={(e) => setTargetBedId(e.target.value)}
              className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition cursor-pointer"
              required
            >
              <option value="">Selecciona una cama libre...</option>
              {availableBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.wing} - Habitación {b.room}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase mb-1.5">
              Motivo / Observaciones del Traslado
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Cambio a mayor complejidad (UCI) por evolución clínica..."
              rows="3"
              className="w-full bg-[#0F172A] border border-slate-700 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-blue-500 transition resize-none"
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-blue-900/20 cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Procesando...' : 'Confirmar Traslado'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}