import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getGenericPassword,
  setGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';

// Supabase はセッション全体（アクセストークン＋リフレッシュトークン＋user）を
// 1つのキー（sb-<ref>-auth-token）配下に JSON で保存する。
// その保存先を OS のセキュアストア（iOS: Keychain / Android: Keystore 連携）に置く。
// AsyncStorage より消えにくく、iOS では再インストールしてもセッションが残る。
// セキュアストアが使えない端末では AsyncStorage にフォールバックし、
// セッションを絶対に失わないようにする。
//
// アクセス性はライブラリ既定の AccessibleAfterFirstUnlock（初回アンロック後は
// バックグラウンドでも読める）を使うため、accessible は指定しない。

const serviceFor = (key: string) => `supabase_session::${key}`;

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    // 1. セキュアストアから読む
    try {
      const res = await getGenericPassword({ service: serviceFor(key) });
      if (res && res.password) {
        return res.password;
      }
    } catch {
      // 読めない端末は下のフォールバックへ
    }

    // 2. 旧 AsyncStorage にセッションがあれば、セキュアストアへ移行して返す（1回きり）
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy != null) {
        try {
          await setGenericPassword(key, legacy, { service: serviceFor(key) });
          await AsyncStorage.removeItem(key);
        } catch {
          // 移行に失敗しても legacy 値は返す（ログインは維持される）
        }
        return legacy;
      }
    } catch {
      // ignore
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await setGenericPassword(key, value, { service: serviceFor(key) });
      // セキュアストアに書けたら、古いフォールバックは消す（トークン取り違え防止）
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // ignore
      }
      return;
    } catch {
      // セキュアストアが使えない端末はここに来る
    }
    // 最後の砦：セッションを失わないよう AsyncStorage に保存
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await resetGenericPassword({ service: serviceFor(key) });
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
