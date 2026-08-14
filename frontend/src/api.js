// frontend/src/api.js

// Remueve cualquier '/' al final de la URL base para asegurar consistencia
const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';
const BASE_URL = RAW_BASE_URL.replace(/\/+$/, '');

/**
 * Función wrapper principal para peticiones a la API
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    ...options.headers,
  };

  // Asigna Content-Type solo si hay un body y NO es FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Agrega el token de autenticación si existe
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Asegura que el endpoint comience siempre con '/'
  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  try {
    const response = await fetch(`${BASE_URL}${formattedEndpoint}`, {
      ...options,
      headers,
    });

    // Si la API responde 401 (No autorizado), limpia la sesión expirada
    if (response.status === 401) {
      localStorage.removeItem('token');
    }

    return response;
  } catch (error) {
    console.error(`[API Error] Falla de conexión en: ${formattedEndpoint}`, error);
    throw error;
  }
};

// Mantener alias fetchApi por compatibilidad
export const fetchApi = apiFetch;

// Objeto auxiliar limpiando la conversión de JSON
export const api = {
  get: (endpoint, options = {}) => 
    apiFetch(endpoint, { method: 'GET', ...options }),

  post: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    }),

  put: (endpoint, body, options = {}) =>
    apiFetch(endpoint, {
      method: 'PUT',
      body: typeof body === 'string' ? body : JSON.stringify(body),
      ...options,
    }),

  delete: (endpoint, options = {}) => 
    apiFetch(endpoint, { method: 'DELETE', ...options }),
};