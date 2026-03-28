import { createClient } from '@supabase/supabase-js'

// Vite requiere el prefijo VITE_ para exponer las variables al cliente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Faltan las variables de entorno de Supabase en el archivo .env");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)