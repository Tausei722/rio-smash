import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://ehqhipghekqkrhfromef.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVocWhpcGdoZWtxa3JoZnJvbWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3Njg2MjgsImV4cCI6MjA5MDM0NDYyOH0.ZjLuW55Uazd2AlUIvHC59oNX8kBotgwGLsncVm9DBhc';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
