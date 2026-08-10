// frontend/src/api.js

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';

/**
 * Función wrapper principal para peticiones a la API
 */
export const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Si la API responde 401, el token venció o no existe
  if (response.status === 401) {
    localStorage.removeItem('token');
  }

  return response;
};

// Mantener alias fetchApi por compatibilidad si se usa en otros archivos
export const fetchApi = apiFetch;

// Objeto auxiliar por si lo usas en AuthContext
export const api = {
  get: (endpoint) => apiFetch(endpoint, { method: 'GET' }),
  post: (endpoint, body) =>
    apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  put: (endpoint, body) =>
    apiFetch(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: (endpoint) => apiFetch(endpoint, { method: 'DELETE' }),
};