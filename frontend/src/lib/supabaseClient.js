import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
	// Provide a helpful console error during development when env vars are missing
	console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Add them to .env and restart the dev server.')
	// Export a stub that throws on use to make errors explicit
	const missingProxy = new Proxy({}, {
		get() {
			return () => { throw new Error('Supabase client not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file and restart Vite.') }
		}
	})
	export const supabase = missingProxy
} else {
	export const supabase = createClient(supabaseUrl, supabaseAnonKey)
}