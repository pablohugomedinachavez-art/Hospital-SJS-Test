import { createClient } from '@supabase/supabase-js'
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000/api';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env and restart the dev server.')
	const missingProxy = new Proxy({}, {
		get() {
			return () => { throw new Error('Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart Vite.') }
		}
	})
	export const supabase = missingProxy
} else {
	export const supabase = createClient(supabaseUrl, supabaseAnonKey)
}

export { API_URL }