import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// A syntactically valid inert client prevents a module-import crash so the root
// layout can render a useful configuration error. Service calls remain guarded
// by the root screen in a misconfigured build.
export const supabase = createClient(
  supabaseUrl || 'https://configuration-required.invalid',
  supabaseAnonKey || 'configuration-required',
  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  },
);
