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

  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // ASEGÚRATE DE QUE EL MÉTODO SEA MAYÚSCULA (Por defecto GET si no viene)
  const method = (options.method || 'GET').toUpperCase();

  console.log(`[API DEBUG] Enviando ${method} a: ${BASE_URL}${formattedEndpoint}`);

  try {
    const response = await fetch(`${BASE_URL}${formattedEndpoint}`, {
      ...options,
      method, // Forzamos el método en mayúsculas
      headers,
    });

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
      // Si es FormData, se queda como está; de lo contrario, se convierte a JSON
      body: body instanceof FormData || typeof body === 'string' ? body : JSON.stringify(body),
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