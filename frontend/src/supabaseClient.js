// This file remains for compatibility, but the current project uses the local Flask API
// and SQLite backend instead of Supabase.

export function fetchSupabaseTable() {
  throw new Error('Supabase is not used in this local setup. Use the backend API under /api instead.')
}

export function insertSupabaseRow() {
  throw new Error('Supabase is not used in this local setup. Use the backend API under /api instead.')
}
