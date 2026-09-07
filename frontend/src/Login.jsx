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

  // Estados para el Modal de Recuperación
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

      if (!isRegister) {
        setPasswordError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotMessage('');
    setForgotLoading(true);

    try {
      if (resetPassword) {
        await resetPassword(resetEmail);
      }
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

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError('');
    setPasswordError(false);
  };

  return (
    <div className="login-overlay" style={styles.overlay}>
      {/* CSS Personalizado para la animación de Trazo Único Continuo */}
      <style>
        {`
          /* Animación de trazado que recorre la línea completa de izquierda a derecha */
          @keyframes ecgContinuousLine {
            0% {
              stroke-dashoffset: 1600;
            }
            100% {
              stroke-dashoffset: -1600;
            }
          }

          .single-ecg-path {
            /* Trazado: segmento visible de la onda + espacio vacío ajustado */
            stroke-dasharray: 450 1600;
            animation: ecgContinuousLine 3.5s linear infinite;
          }

          /* Interacciones y animaciones en Inputs */
          .custom-input {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .custom-input:hover {
            border-color: #3b82f6 !important;
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.25);
            transform: translateX(2px);
          }
          .custom-input:focus {
            border-color: #60a5fa !important;
            box-shadow: 0 0 18px rgba(96, 165, 250, 0.4);
            background-color: #030712 !important;
          }

          .input-container:hover .input-icon-svg {
            color: #60a5fa !important;
            transform: scale(1.15) rotate(-5deg);
          }
          .input-icon-svg {
            transition: transform 0.3s ease, color 0.3s ease;
          }

          /* Botón Principal con Efecto Shimmer */
          .btn-shimmer {
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .btn-shimmer::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: linear-gradient(
              60deg,
              transparent 30%,
              rgba(255, 255, 255, 0.25) 50%,
              transparent 70%
            );
            transform: rotate(30deg) translateX(-100%);
            transition: transform 0.75s ease;
          }
          .btn-shimmer:hover::before {
            transform: rotate(30deg) translateX(100%);
          }
          .btn-shimmer:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(37, 99, 235, 0.5) !important;
            background-color: #1d4ed8 !important;
          }
          .btn-shimmer:active {
            transform: translateY(1px) scale(0.98);
          }

          .eye-btn-anim {
            transition: transform 0.2s ease, color 0.2s ease;
          }
          .eye-btn-anim:hover {
            transform: scale(1.15);
          }
          .eye-btn-anim:hover svg {
            color: #93c5fd !important;
          }
        `}
      </style>

      {/* Fondo de Electrocardiograma en Línea Única (Sin Brillos de Fondo) */}
      <div style={styles.ecgBackground}>
        <svg
          viewBox="0 0 1200 150"
          preserveAspectRatio="none"
          style={styles.ecgSvg}
        >
          {/* Un único trazo continuo cruzando la pantalla */}
          <path
            className="single-ecg-path"
            d="M0,75 L300,75 L310,45 L320,105 L330,20 L345,135 L360,60 L370,85 L380,75 L700,75 L710,45 L720,105 L730,20 L745,135 L760,60 L770,85 L780,75 L1200,75"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.9"
          />
        </svg>
      </div>

      {/* Header Institucional */}
      <header style={styles.header}>
        <div style={styles.brandContainer}>
          <div style={styles.logoBadge}>
            <svg style={styles.logoIcon} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <h1 style={styles.hospitalTitle}>Hospital San José de Chincha</h1>
        </div>
        <span style={styles.areaBadge}>Área de Seguros</span>
      </header>

      {/* Tarjeta Central Inmóvil */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h2 style={styles.cardTitle}>
            {isRegister ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </h2>
          <p style={styles.cardSubtitle}>
            {isRegister
              ? 'Ingresa tus datos para registrarte en el sistema'
              : 'Accede con tus credenciales autorizadas'}
          </p>
        </div>

        {/* Alerta General */}
        {error && !passwordError && (
          <div style={styles.errorBox}>
            <svg style={styles.errorIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Campo Usuario */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Usuario / Correo</label>
            <div className="input-container" style={styles.inputWrapper}>
              <svg className="input-icon-svg" style={styles.inputIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <input
                type="text"
                required
                className="custom-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ingresa tu usuario o correo"
                style={styles.input}
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Contraseña</label>
            <div className="input-container" style={styles.inputWrapper}>
              <svg
                className="input-icon-svg"
                style={{ ...styles.inputIcon, color: passwordError ? '#f87171' : '#64748b' }}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                className="custom-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError(false);
                }}
                placeholder="••••••••"
                style={{
                  ...styles.input,
                  paddingRight: '42px',
                  borderColor: passwordError ? '#ef4444' : '#334155',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="eye-btn-anim"
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <svg style={styles.actionIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg style={styles.actionIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12c1.341-4.55 5.43-7.5 9.964-7.5 4.533 0 8.623 2.95 9.964 7.5-1.341 4.55-5.43 7.5-9.964 7.5-4.533 0-8.623-2.95-9.964-7.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Error de contraseña y recuperación */}
            {passwordError && (
              <div style={styles.passwordErrorContainer}>
                <div style={styles.passwordErrorText}>
                  <svg style={styles.miniErrorIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <span>Contraseña incorrecta. Por favor vuelve a intentarlo.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={styles.inlineForgotBtn}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            )}
          </div>

          {/* Botón Principal */}
          <button type="submit" disabled={loading} className="btn-shimmer" style={styles.submitBtn}>
            {loading ? 'Procesando...' : isRegister ? 'Registrarse' : 'Ingresar'}
          </button>
        </form>

        {/* Toggle Modo */}
        <div style={styles.toggleFooter}>
          <span style={styles.toggleText}>
            {isRegister ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'}
          </span>
          <button type="button" onClick={toggleMode} style={styles.toggleBtn}>
            {isRegister ? 'Inicia sesión aquí' : 'Regístrate aquí'}
          </button>
        </div>
      </div>

      {/* Modal de Recuperación */}
      {showForgotModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalBadge}>
                <svg style={styles.modalIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                </svg>
              </div>
              <div>
                <h3 style={styles.modalTitle}>Recuperar Contraseña</h3>
                <p style={styles.modalSubtitle}>Te enviaremos un correo para restablecer tu acceso</p>
              </div>
            </div>

            {forgotMessage && (
              <div style={styles.infoBox}>
                <span>{forgotMessage}</span>
              </div>
            )}

            <form onSubmit={handleForgotSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Correo Electrónico Registrado</label>
                <div className="input-container" style={styles.inputWrapper}>
                  <svg className="input-icon-svg" style={styles.inputIcon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input
                    type="email"
                    required
                    className="custom-input"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="ejemplo@hospital.com"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotMessage('');
                  }}
                  style={styles.cancelBtn}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={forgotLoading} className="btn-shimmer" style={styles.submitBtnModal}>
                  {forgotLoading ? 'Enviando...' : 'Enviar enlace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: '#080c15',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxSizing: 'border-box',
    margin: 0,
    padding: '20px',
    zIndex: 9999,
    overflow: 'hidden',
  },
  ecgBackground: {
    position: 'absolute',
    top: '50%',
    left: 0,
    width: '100%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    zIndex: 1,
    overflow: 'hidden',
  },
  ecgSvg: {
    width: '100%',
    height: '140px',
    display: 'block',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 32px',
    boxSizing: 'border-box',
    zIndex: 10,
  },
  brandContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logoBadge: {
    width: '36px',
    height: '36px',
    backgroundColor: '#2563eb',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoIcon: {
    width: '20px',
    height: '20px',
    color: '#ffffff',
  },
  hospitalTitle: {
    margin: 0,
    fontSize: '1.2rem',
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: '-0.02em',
  },
  areaBadge: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#60a5fa',
    backgroundColor: 'rgba(30, 58, 138, 0.5)',
    border: '1px solid rgba(30, 64, 175, 0.6)',
    padding: '6px 14px',
    borderRadius: '20px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  card: {
    position: 'relative',
    zIndex: 2,
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '16px',
    padding: '32px 28px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
    boxSizing: 'border-box',
  },
  cardHeader: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  cardTitle: {
    margin: '0 0 6px 0',
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  cardSubtitle: {
    margin: 0,
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  errorBox: {
    backgroundColor: 'rgba(127, 29, 29, 0.4)',
    border: '1px solid #991b1b',
    borderRadius: '10px',
    padding: '10px 12px',
    color: '#fca5a5',
    fontSize: '0.825rem',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
    color: '#f87171',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#cbd5e1',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    width: '20px',
    height: '20px',
    color: '#64748b',
    pointerEvents: 'none',
    flexShrink: 0,
  },
  input: {
    width: '100%',
    height: '42px',
    paddingLeft: '40px',
    paddingRight: '12px',
    backgroundColor: '#020617',
    border: '1px solid #334155',
    borderRadius: '10px',
    color: '#f8fafc',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    width: '20px',
    height: '20px',
    color: '#64748b',
    flexShrink: 0,
  },

  passwordErrorContainer: {
    marginTop: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  passwordErrorText: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.775rem',
    color: '#f87171',
  },
  miniErrorIcon: {
    width: '14px',
    height: '14px',
    flexShrink: 0,
  },
  inlineForgotBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: '0.775rem',
    fontWeight: '600',
    textAlign: 'left',
    cursor: 'pointer',
    padding: 0,
  },

  submitBtn: {
    marginTop: '8px',
    height: '44px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.9rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
  },
  toggleFooter: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #1e293b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  toggleText: {
    fontSize: '0.8rem',
    color: '#64748b',
  },
  toggleBtn: {
    background: 'none',
    border: 'none',
    color: '#60a5fa',
    fontSize: '0.85rem',
    fontWeight: '600',
    cursor: 'pointer',
  },

  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 10000,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '16px',
    padding: '24px',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  },
  modalBadge: {
    width: '40px',
    height: '40px',
    backgroundColor: 'rgba(30, 58, 138, 0.4)',
    border: '1px solid rgba(37, 99, 235, 0.4)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  modalIcon: {
    width: '20px',
    height: '20px',
    color: '#60a5fa',
  },
  modalTitle: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: '700',
    color: '#f8fafc',
  },
  modalSubtitle: {
    margin: 0,
    fontSize: '0.75rem',
    color: '#94a3b8',
  },
  infoBox: {
    backgroundColor: 'rgba(30, 58, 138, 0.3)',
    border: '1px solid rgba(37, 99, 235, 0.5)',
    borderRadius: '8px',
    padding: '10px 12px',
    color: '#93c5fd',
    fontSize: '0.8rem',
    marginBottom: '14px',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '12px',
  },
  cancelBtn: {
    padding: '8px 14px',
    backgroundColor: '#1e293b',
    color: '#cbd5e1',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  submitBtnModal: {
    padding: '8px 14px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.8rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
};