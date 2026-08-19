import React from 'react'

export default function DocumentDetailModal({ document, onClose }) {
  if (!document) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: '12px', padding: '24px',
        width: '90%', maxWidth: '1200px', height: '85vh',
        display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.3)'
      }}>
        {/* CABECERA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', pb: '12px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Documento #{document.id}</h2>
          <button 
            onClick={onClose} 
            style={{ padding: '6px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
            Cerrar
          </button>
        </div>

        {/* CONTENIDOR PRINCIPAL: PANEL IZQUIERDO Y PANEL DERECHO */}
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
          
          {/* PANEL IZQUIERDO: DATOS DEL PACIENTE Y DOCUMENTO */}
          <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', overflowY: 'auto' }}>
            <h3 style={{ marginTop: 0, fontSize: '1rem', color: '#374151', borderBottom: '1px solid #d1d5db', paddingBottom: '8px' }}>
              Información Registrada
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', fontSize: '0.9rem' }}>
              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>Paciente</strong>
                <span style={{ fontWeight: 600, color: '#111827' }}>{document.patient_name || 'N/A'}</span>
              </div>

              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>DNI / Historia Clínica</strong>
                <span>{document.dni || document.medical_record_number || 'N/A'}</span>
              </div>

              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>Tipo de Documento</strong>
                <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                  {document.document_type}
                </span>
              </div>

              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>Nombre de Archivo</strong>
                <span style={{ wordBreak: 'break-all' }}>{document.file_name}</span>
              </div>

              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>Fecha de Carga</strong>
                <span>{new Date(document.created_at).toLocaleString()}</span>
              </div>

              <div>
                <strong style={{ color: '#6b7280', display: 'block' }}>Descripción / Notas</strong>
                <p style={{ margin: '4px 0 0 0', color: '#4b5563', whiteSpace: 'pre-wrap' }}>
                  {document.description || 'Sin observaciones registradas.'}
                </p>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: VISOR DEL PDF */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', background: '#525659', display: 'flex', flexDirection: 'column' }}>
            {document.file_url ? (
              <iframe
                src={`${document.file_url}#toolbar=1`}
                title="Previsualización PDF"
                width="100%"
                height="100%"
                style={{ border: 'none', flex: 1 }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', textAlign: 'center', padding: '20px' }}>
                <p>No hay un archivo cargado o no se puede generar la vista previa del PDF.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}