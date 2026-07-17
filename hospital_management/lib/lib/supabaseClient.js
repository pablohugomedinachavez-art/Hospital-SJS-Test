const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  restPath: '/rest/v1'
}

