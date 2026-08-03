export function apiFetch(path, opts = {}){
  const token = localStorage.getItem('token')
  const headers = opts.headers || {}
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = 'Bearer ' + token
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  return fetch(baseUrl + path, {...opts, headers})
}
