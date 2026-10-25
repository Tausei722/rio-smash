import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { secureSessionStorage } from './sessionStorage';

const SUPABASE_URL = 'https://xilrpvnierjjuouduqsg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbHJwdm5pZXJqanVvdWR1cXNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDkwMTYsImV4cCI6MjA5MTIyNTAxNn0.PYzS3cvJ6ZRIxgVYzaBYa9emsNg8aw4hlhs5gyeFOoE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // セッションは OS セキュアストア（iOS: Keychain / Android: Keystore）に保存する。
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native では、アプリがフォアグラウンドのときだけトークン自動更新を回す必要がある。
// これをしないと、バックグラウンド中に更新タイマーが空回りして失敗し、
// リフレッシュトークンのローテーション再利用検知でセッションごと失効＝強制ログアウトになる。
let autoRefreshRunning = false;
const syncAutoRefresh = (state: string) => {
  if (state === 'active') {
    if (!autoRefreshRunning) {
      supabase.auth.startAutoRefresh();
      autoRefreshRunning = true;
    }
  } else if (autoRefreshRunning) {
    supabase.auth.stopAutoRefresh();
    autoRefreshRunning = false;
  }
};

syncAutoRefresh(AppState.currentState ?? 'active');
AppState.addEventListener('change', syncAutoRefresh);
