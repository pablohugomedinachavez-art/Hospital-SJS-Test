import React from 'react';

// Íconos SVG sencillos para métricas
export const StatIcons = {
  Patients: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  Consultations: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Users: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5 5 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Time: () => (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// Tarjeta KPI individual
export function StatCard({ icon, label, value, hint, tone = 'primary' }) {
  const tones = {
    primary: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '#1e293b' },
    success: { bg: 'rgba(45, 212, 191, 0.1)', color: '#2dd4bf', border: '#1e293b' },
    warning: { bg: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '#1e293b' },
  };

  const currentTone = tones[tone] || tones.primary;

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: `1px solid ${currentTone.border}`,
        borderRadius: '16px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '0.75rem',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            backgroundColor: currentTone.bg,
            color: currentTone.color,
            padding: '0.6rem',
            borderRadius: '12px',
            display: 'inline-flex',
          }}
        >
          {icon}
        </div>
      </div>
      <div>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
          {label}
        </span>
        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>
          {value}
        </div>
        {hint && (
          <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', marginTop: '0.2rem' }}>
            {hint}
          </span>
        )}
      </div>
    </div>
  );
}

// Pantalla / Indicador de Carga
export function LoadingState({ label = 'Cargando datos...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: '#94a3b8' }}>
      <div
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid #1e293b',
          borderTopColor: '#38bdf8',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <span style={{ fontSize: '0.875rem' }}>{label}</span>
    </div>
  );
}