import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../db/supabase';

type Props = {
  onLoggedIn: () => void;
};

export function LoginScreen({ onLoggedIn }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('入力エラー', '正しいメールアドレスを入力してください。');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (error) {
      Alert.alert('ログイン失敗', error.message);
    } else {
      onLoggedIn();
    }
  };

  const handleSignUp = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !passwordConfirm.trim()) {
      Alert.alert('入力エラー', 'すべての項目を入力してください。');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('入力エラー', '正しいメールアドレスを入力してください。');
      return;
    }
    if (password !== passwordConfirm) {
      Alert.alert('入力エラー', 'パスワードが一致していません。');
      return;
    }
    if (password.length < 6) {
      Alert.alert('入力エラー', 'パスワードは6文字以上にしてください。');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) {
      setLoading(false);
      Alert.alert('登録失敗', `${error.message}\n\ncode: ${error.status ?? ''}`);
      return;
    }
    // profiles テーブルにユーザー名を保存
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: username.trim(),
        is_admin: false,
      });
    }
    setLoading(false);
    if (data.session) {
      onLoggedIn();
    } else if (data.user) {
      // メール認証が有効な場合はログイン画面へ
      Alert.alert('登録完了', 'アカウントを作成しました。ログインしてください。', [
        { text: 'OK', onPress: () => setMode('login') },
      ]);
    }
  };

  const switchMode = () => {
    setMode(m => (m === 'login' ? 'signup' : 'login'));
    setUsername('');
    setPassword('');
    setPasswordConfirm('');
  };

  const isLogin = mode === 'login';

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoArea}>
          <Text style={styles.emoji}>🗣️</Text>
          <Text style={styles.title}>英単語対戦</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'ログインして始めよう' : 'アカウントを作成'}
          </Text>
        </View>

        {/* タブ切り替え */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tab, isLogin && styles.tabActive]}
            onPress={() => !isLogin && switchMode()}
          >
            <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>ログイン</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, !isLogin && styles.tabActive]}
            onPress={() => isLogin && switchMode()}
          >
            <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>新規登録</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <>
              <Text style={styles.label}>ユーザー名</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="ニックネームを入力"
                placeholderTextColor="#94a3b8"
                autoCorrect={false}
              />
            </>
          )}

          <Text style={styles.label}>メールアドレス</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />

          <Text style={styles.label}>パスワード</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={isLogin ? 'パスワードを入力' : '6文字以上'}
            placeholderTextColor="#94a3b8"
            secureTextEntry
          />

          {!isLogin && (
            <>
              <Text style={styles.label}>パスワード（確認）</Text>
              <TextInput
                style={styles.input}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                placeholder="もう一度入力"
                placeholderTextColor="#94a3b8"
                secureTextEntry
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={isLogin ? handleLogin : handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'ログイン' : 'アカウント作成'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ecfeff',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 20,
  },
  logoArea: {
    alignItems: 'center',
    gap: 8,
  },
  emoji: {
    fontSize: 64,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0e7490',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#0e7490',
  },
  form: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  submitButton: {
    backgroundColor: '#0e7490',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#0e7490',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
