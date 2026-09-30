import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl === 'https://your-project-url.supabase.co' || !supabaseAnonKey || supabaseAnonKey === 'your-supabase-anon-key') {
  console.warn('Supabase credentials are placeholders. Please update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '')
