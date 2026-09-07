import React, { useState } from 'react';
import { useAuth } from './AuthContext';

export function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Estados para Modal de Recuperación
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login, register, resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setPasswordError(false);
    setLoading(true);

    try {
      if (isRegister) {
        if (register) {
          await register(username, password);
        } else {
          throw new Error('La función de registro no está disponible');
        }
      } else {
        await login(username, password);
      }
    } catch (err) {
      const msg = err.message || 'Error de autenticación';
      setError(msg);
      if (!isRegister) setPasswordError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotLoading(true);

    try {
      if (resetPassword) await resetPassword(resetEmail);
      setForgotMessage('Se han enviado las instrucciones a tu correo.');
      setTimeout(() => {
        setShowForgotModal(false);
        setResetEmail('');
        setForgotMessage('');
      }, 3000);
    } catch (err) {
      setForgotMessage(err.message || 'Ocurrió un error al procesar la solicitud.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      {/* ----------------- FONDO MOSAICO (LAYOUT DE LA FOTO) ----------------- */}
      <div style={styles.backgroundGrid}>
        {/* Lado Izquierdo Oscuro / Radiografía / Estetoscopio */}
        <div style={styles.bgLeftSection}>
          <div style={styles.bgOverlayDark} />
          {/* Ilustración o SVG de Ecocardiograma / Monitor de Signos Vitales */}
          <div style={styles.ecgMonitorGraphic}>
            <svg viewBox="0 0 200 150" fill="none" style={styles.ecgSvg}>
              <rect x="10" y="10" width="180" height="130" rx="15" stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="rgba(15,23,42,0.6)" />
              <path d="M 20 80 L 60 80 L 70 50 L 80 110 L 95 30 L 110 95 L 120 80 L 180 80" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Lado Derecho Superior con Foto del Hospital */}
        <div style={styles.bgRightTopSection}>
          <div style={styles.bgHospitalPhoto} />
          <div style={styles.bgOverlayBlueTint} />
        </div>

        {/* Cuadrantes Inferiores (Gotas, Pulso, Caduceo) */}
        <div style={styles.bgBottomGrid}>
          <div style={styles.bgBottomLeft}>
            {/* Icono de gotas de sangre / agua */}
            <svg style={styles.dropIcon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <div style={styles.bgBottomCenter}>
            {/* Onda ECG azul brillante */}
            <svg viewBox="0 0 100 40" style={{ width: '80%', height: '40px' }}>
              <path d="M 0 20 L 30 20 L 38 5 L 46 35 L 54 10 L 62 25 L 70 20 L 100 20" stroke="#00d2ff" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <div style={styles.bgBottomRight}>
            {/* Símbolo Caduceo / Medicina */}
            <svg style={styles.caduceusIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2v20M9 5c0 3 6 3 6 6s-6 3-6 6 6 3 6 3M15 5c0 3-6 3-6 6s6 3 6 6-6 3-6 3" />
            </svg>
          </div>
        </div>
      </div>

      {/* ----------------- HEADER CON CURVA Y LOGO REDONDO ----------------- */}
      <header style={styles.topHeader}>
        <div style={styles.curvedWhiteCard}>
          <img
            src="/assets/logo-hospital.png"
            alt="Hospital San José Chincha"
            style={styles.hospitalLogoRound}
          />
        </div>
        <div style={styles.areaBadge}>ÁREA DE SEGUROS</div>
      </header>

      {/* ----------------- FORMULARIO CENTRAL GLASSMORPHISM CELESTE ----------------- */}
      <main style={styles.mainContent}>
        <div style={styles.glassCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>
              {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </h2>
            <p style={styles.cardSubtitle}>
              {isRegister
                ? 'Ingresa tus datos para registrarte'
                : 'Accede con tus credenciales autorizadas'}
            </p>
          </div>

          {error && !passwordError && (
            <div style={styles.errorAlert}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>USUARIO / CORREO</label>
              <div style={styles.inputContainer}>
                <svg style={styles.inputIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ingresa tu usuario o correo"
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>CONTRASEÑA</label>
              <div style={styles.inputContainer}>
                <svg style={styles.inputIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(false);
                  }}
                  placeholder="••••••••"
                  style={styles.input}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <svg style={{ width: '18px', height: '18px', color: '#64748b' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.341-4.55 5.43-7.5 9.964-7.5 4.533 0 8.623 2.95 9.964 7.5-1.341 4.55-5.43 7.5-9.964 7.5-4.533 0-8.623-2.95-9.964-7.5z" />
                  </svg>
                </button>
              </div>

              {passwordError && (
                <div style={styles.passwordErrorBox}>
                  <span>Contraseña incorrecta.</span>
                  <button type="button" onClick={() => setShowForgotModal(true)} style={styles.forgotBtn}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} style={styles.submitButton}>
              {loading ? 'Ingresando...' : isRegister ? 'Registrarse' : 'Ingresar'}
            </button>
          </form>

          <div style={styles.statusIndicator}>
            <svg style={styles.heartIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <span style={{ fontSize: '0.8rem', color: '#1e3a8a' }}>Validando...</span>
          </div>

          <div style={styles.footerToggle}>
            <span style={{ fontSize: '0.8rem', color: '#334155' }}>
              {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              style={styles.toggleLink}
            >
              {isRegister ? 'Inicia sesión aquí' : 'Regístrate aquí'}
            </button>
          </div>
        </div>

        {/* Insignia Inferior Flotante de Pulso Heartbeat */}
        <div style={styles.floatingHeartBadge}>
          <svg style={{ width: '28px', height: '28px', color: '#38bdf8' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
      </main>

      {/* Modal de Recuperación */}
      {showForgotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Recuperar Contraseña</h3>
            {forgotMessage && <p style={{ fontSize: '0.85rem', color: '#2563eb' }}>{forgotMessage}</p>}
            <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Tu correo electrónico"
                style={{ ...styles.input, backgroundColor: '#f1f5f9', color: '#0f172a' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowForgotModal(false)} style={styles.cancelBtn}>
                  Cancelar
                </button>
                <button type="submit" disabled={forgotLoading} style={styles.submitButton}>
                  {forgotLoading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------- ESTILOS EXACTOS BASADOS EN LA SEGUNDA CAPTURA -----------------
const styles = {
  pageContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#07162c',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column',
  },

  /* Mosaico de Fondo */
  backgroundGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows: '70% 30%',
    zIndex: 1,
  },
  bgLeftSection: {
    position: 'relative',
    backgroundColor: '#0c1e38',
    backgroundImage: 'url("/assets/estetoscopio-bg.jpg")', // Ocupa el lado izquierdo
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgOverlayDark: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(7, 22, 44, 0.75)',
  },
  ecgMonitorGraphic: {
    position: 'relative',
    zIndex: 2,
    width: '200px',
    height: '150px',
    opacity: 0.8,
  },
  ecgSvg: {
    width: '100%',
    height: '100%',
  },
  bgRightTopSection: {
    position: 'relative',
    overflow: 'hidden',
  },
  bgHospitalPhoto: {
    width: '100%',
    height: '100%',
    backgroundImage: 'url("/assets/fachada-hospital-chincha.jpg")', // Fachada del hospital
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  },
  bgOverlayBlueTint: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(56, 189, 248, 0.25)', // Tono azul claro semitransparente sobre el hospital
  },
  bgBottomGrid: {
    gridColumn: '1 / -1',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    backgroundColor: '#091a32',
    borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  bgBottomLeft: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 30, 56, 0.9)',
  },
  dropIcon: {
    width: '40px',
    height: '40px',
    color: '#ffffff',
    opacity: 0.9,
  },
  bgBottomCenter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#061325',
    borderLeft: '1px solid rgba(255,255,255,0.05)',
    borderRight: '1px solid rgba(255,255,255,0.05)',
  },
  bgBottomRight: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a1d37',
  },
  caduceusIcon: {
    width: '48px',
    height: '48px',
    color: '#1d4ed8',
  },

  /* Top Header con Curva Grande Superior Izquierda */
  topHeader: {
    position: 'relative',
    zIndex: 10,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingRight: '32px',
  },
  curvedWhiteCard: {
    backgroundColor: '#ffffff',
    width: '260px',
    height: '110px',
    borderBottomRightRadius: '130px', // Orea la curva pronunciada de la foto
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '24px',
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
  },
  hospitalLogoRound: {
    width: '85px',
    height: '85px',
    objectFit: 'contain',
  },
  areaBadge: {
    marginTop: '20px',
    padding: '8px 20px',
    backgroundColor: '#1d4ed8',
    color: '#ffffff',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: '700',
    letterSpacing: '0.05em',
    boxShadow: '0 4px 12px rgba(29, 78, 216, 0.4)',
  },

  /* Formulario Central (Glassmorphism Celeste) */
  mainContent: {
    position: 'relative',
    zIndex: 10,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassCard: {
    width: '100%',
    maxWidth: '370px',
    backgroundColor: 'rgba(186, 230, 253, 0.55)', // Color celeste translúcido idéntico
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '24px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    padding: '32px 28px',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    boxSizing: 'border-box',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  cardTitle: {
    margin: '0 0 6px 0',
    fontSize: '1.45rem',
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    margin: 0,
    fontSize: '0.78rem',
    color: '#334155',
  },
  errorAlert: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    color: '#991b1b',
    padding: '8px',
    borderRadius: '8px',
    fontSize: '0.8rem',
    marginBottom: '12px',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#1e293b',
    letterSpacing: '0.03em',
  },
  inputContainer: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    width: '18px',
    height: '18px',
    color: '#475569',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    height: '40px',
    paddingLeft: '38px',
    paddingRight: '36px',
    backgroundColor: 'rgba(51, 65, 85, 0.45)', // Gris/Azul oscuro semitransparente de la captura
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '0.85rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  passwordErrorBox: {
    marginTop: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '0.75rem',
    color: '#b91c1c',
  },
  forgotBtn: {
    background: 'none',
    border: 'none',
    color: '#1d4ed8',
    fontSize: '0.75rem',
    cursor: 'pointer',
    textAlign: 'left',
    padding: 0,
    fontWeight: '600',
  },
  submitButton: {
    marginTop: '6px',
    height: '40px',
    backgroundColor: '#7dd3fc', // Celeste botón
    color: '#0f172a',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9rem',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(125, 211, 252, 0.3)',
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    marginTop: '12px',
  },
  heartIcon: {
    width: '14px',
    height: '14px',
    color: '#1e3a8a',
  },
  footerToggle: {
    marginTop: '14px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  toggleLink: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
  },

  /* Elemento Flotante en la parte inferior */
  floatingHeartBadge: {
    position: 'absolute',
    bottom: '-20px',
    width: '50px',
    height: '50px',
    backgroundColor: '#091a32',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
    border: '2px solid rgba(56, 189, 248, 0.3)',
  },

  /* Modal */
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '16px',
    width: '320px',
  },
  cancelBtn: {
    padding: '8px 12px',
    backgroundColor: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
};