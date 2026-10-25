import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../components/Icon';

type Props = {
  onBack: () => void;
  username: string | null;
  isPremium: boolean;
  isAdmin: boolean;
  onSaveUsername: (newName: string) => Promise<void>;
  onPurchase: () => void;
  onRestore: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
};

export function ProfileScreen({
  onBack, username, isPremium, isAdmin,
  onSaveUsername, onPurchase, onRestore, onLogout, onDeleteAccount,
}: Props) {
  const [nameInput, setNameInput] = useState(username ?? '');
  const [saving, setSaving] = useState(false);

  const dirty = nameInput.trim() !== (username ?? '') && nameInput.trim().length > 0;
  const initial = (username ?? '?').trim().charAt(0).toUpperCase() || '?';

  const handleSave = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSaveUsername(trimmed);
      Alert.alert('保存しました');
    } catch {
      Alert.alert('エラー', 'ユーザー名の保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={[styles.backButton, styles.backRow]}>
          <Icon name="back" size="sm" color="#ffffff" />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>マイページ</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ユーザー名</Text>
          <TextInput
            style={styles.nameInput}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="ユーザー名を入力"
            placeholderTextColor="#94a3b8"
            maxLength={20}
          />
          <TouchableOpacity
            style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!dirty || saving}
          >
            <Text style={styles.saveBtnText}>{saving ? '保存中...' : '保存'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>会員ステータス</Text>
          <View style={styles.statusRow}>
            {isPremium ? (
              <View style={[styles.premiumBadge, styles.badgeRow]}>
                <Icon name="premium" size="sm" color="#b45309" fill="#b45309" />
                <Text style={styles.premiumBadgeText}>プレミアム会員</Text>
              </View>
            ) : (
              <View style={styles.freeBadge}>
                <Text style={styles.freeBadgeText}>無料プラン</Text>
              </View>
            )}
            {isAdmin && (
              <View style={[styles.adminBadge, styles.badgeRow]}>
                <Icon name="admin" size="sm" color="#0369a1" />
                <Text style={styles.adminBadgeText}>管理者</Text>
              </View>
            )}
          </View>
          {!isPremium && (
            <View style={styles.premiumActions}>
              <TouchableOpacity style={styles.purchaseBtn} onPress={onPurchase}>
                <Text style={styles.purchaseBtnText}>プレミアムに登録する</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.restoreBtn} onPress={onRestore}>
                <Text style={styles.restoreBtnText}>購入を復元</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.dangerZone}>
          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>ログアウト</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={onDeleteAccount}>
            <Text style={styles.deleteBtnText}>アカウントを削除</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0e7490',
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: '#ffffff',
    fontSize: 15,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#0e7490',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
  },
  nameInput: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 6,
  },
  saveBtn: {
    alignSelf: 'flex-end',
    backgroundColor: '#0e7490',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  saveBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  premiumBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  premiumBadgeText: {
    color: '#b45309',
    fontWeight: '700',
    fontSize: 13,
  },
  freeBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  freeBadgeText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  adminBadge: {
    backgroundColor: '#e0f2fe',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  adminBadgeText: {
    color: '#0369a1',
    fontWeight: '700',
    fontSize: 13,
  },
  premiumActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  purchaseBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  purchaseBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  restoreBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  restoreBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  dangerZone: {
    marginTop: 8,
    gap: 10,
  },
  logoutBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutBtnText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 15,
  },
  deleteBtn: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 15,
  },
});
