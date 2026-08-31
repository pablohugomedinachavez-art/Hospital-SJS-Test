// frontend/src/api.js

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://hospital-sjs-test.onrender.com/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

/**
 * Función wrapper principal para peticiones a la API
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

  const headers = {
    ...options.headers,
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const method = (options.method || 'GET').toUpperCase();

  console.log(`[API DEBUG] Enviando ${method} a: ${BASE_URL}${formattedEndpoint}`);

  try {
    const response = await fetch(`${BASE_URL}${formattedEndpoint}`, {
      ...options,
      method,
      headers,
    });

    if (response.status === 401) {
      console.warn('Sesión no autorizada o expirada (401).');
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    }

    return response;
  } catch (error) {
    console.error(`[API Error] Falla de conexión en: ${formattedEndpoint}`, error);
    throw error;
  }
};

// Mantener alias fetchApi por compatibilidad
export const fetchApi = apiFetch;

// Objeto auxiliar para simplificar métodos HTTP y cuerpos JSON/FormData
export const api = {
  get: (endpoint, options = {}) => 
    apiFetch(endpoint, { method: 'GET', ...options }),

  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'POST',
      body: body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    }),

  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'PUT',
      body: body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    }),

  delete: (endpoint, options = {}) => 
    apiFetch(endpoint, { method: 'DELETE', ...options }),
};