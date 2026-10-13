import { createClient } from '@supabase/supabase-js'
import { createSupabaseClientFrom } from './lib/supabaseConfig.js'

export const supabase = createSupabaseClientFrom(import.meta.env, createClient)
