import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://xilrpvnierjjuouduqsg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbHJwdm5pZXJqanVvdWR1cXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkwMTYsImV4cCI6MjA5MTIyNTAxNn0.PYzS3cvJ6ZRIxgVYzaBYa9emsNg8aw4hlhs5gyeFOoE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
