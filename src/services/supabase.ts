import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co'
  );
};

// Fallback values prevent runtime crashes when env variables are not present
const defaultUrl = supabaseUrl || 'https://placeholder.supabase.co';
const defaultAnonKey = supabaseAnonKey || 'placeholder';

export const supabase: SupabaseClient = createClient(defaultUrl, defaultAnonKey);

export default supabase;
