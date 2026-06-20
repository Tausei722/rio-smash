import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteWord, fetchAllWords, WordRow } from '../db/database';

type Props = {
  onBack: () => void;
  onAddWord: () => void;
  onEditWord: (word: WordRow) => void;
  premiumCategories: Set<string>;
  onSavePremiumCategories: (cats: Set<string>) => Promise<void>;
  categories: string[];
  onSaveCategories: (cats: string[]) => Promise<void>;
  onRenameCategory: (oldName: string, newName: string) => Promise<void>;
};

export function AdminScreen({ onBack, onAddWord, onEditWord, premiumCategories, onSavePremiumCategories, categories, onSaveCategories, onRenameCategory }: Props) {
  const [words, setWords] = useState<WordRow[]>([]);
  const [tab, setTab] = useState<'words' | 'categories'>('words');
  const [localPremiumCats, setLocalPremiumCats] = useState<Set<string>>(new Set(premiumCategories));
  const [catNames, setCatNames] = useState<string[]>(categories);
  const originalCatNames = useRef<string[]>(categories);
  const [saving, setSaving] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    const rows = await fetchAllWords(true);
    setWords(rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = (word: WordRow) => {
    Alert.alert(
      '削除確認',
      `「${word.katakana}」を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await deleteWord(word.id);
            load();
          },
        },
      ],
    );
  };

  const handleAddCategory = () => {
    const trimmed = newCatInput.trim();
    if (!trimmed) return;
    if (catNames.includes(trimmed)) {
      Alert.alert('エラー', 'そのカテゴリ名はすでに存在します');
      return;
    }
    setCatNames(prev => [...prev, trimmed]);
    setNewCatInput('');
  };

  const updateCatName = (index: number, newName: string) => {
    const oldName = catNames[index];
    setCatNames(prev => prev.map((n, i) => i === index ? newName : n));
    // プレミアム設定も追従
    if (localPremiumCats.has(oldName)) {
      setLocalPremiumCats(prev => {
        const next = new Set(prev);
        next.delete(oldName);
        next.add(newName);
        return next;
      });
    }
  };

  const toggleCat = (cat: string) => {
    setLocalPremiumCats(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 名前が変わったカテゴリを DB に反映
      for (let i = 0; i < originalCatNames.current.length; i++) {
        await onRenameCategory(originalCatNames.current[i], catNames[i]);
      }
      originalCatNames.current = [...catNames];
      await onSaveCategories(catNames);
      await onSavePremiumCategories(localPremiumCats);
      Alert.alert('保存しました');
    } catch {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>管理者画面</Text>
        {tab === 'words' ? (
          <TouchableOpacity onPress={onAddWord} style={styles.addButton}>
            <Text style={styles.addText}>＋ 追加</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleSave} style={[styles.addButton, saving && styles.addButtonDisabled]} disabled={saving}>
            <Text style={styles.addText}>{saving ? '保存中...' : '保存'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* タブ */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === 'words' && styles.tabActive]} onPress={() => setTab('words')}>
          <Text style={[styles.tabText, tab === 'words' && styles.tabTextActive]}>単語一覧</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'categories' && styles.tabActive]} onPress={() => setTab('categories')}>
          <Text style={[styles.tabText, tab === 'categories' && styles.tabTextActive]}>カテゴリ設定</Text>
        </TouchableOpacity>
      </View>

      {tab === 'words' ? (
        <>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="カタカナ・英語で検索..."
              placeholderTextColor="#94a3b8"
              clearButtonMode="while-editing"
            />
          </View>
          <WordList
            words={words}
            searchQuery={searchQuery}
            onEdit={onEditWord}
            onDelete={handleDelete}
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.catList}>
          <Text style={styles.catHint}>名前を編集して保存できます。🔒 スイッチで有料設定。</Text>
          {catNames.map((cat, index) => (
            <View key={index} style={styles.catRow}>
              <TextInput
                style={styles.catNameInput}
                value={cat}
                onChangeText={text => updateCatName(index, text)}
                placeholder="カテゴリ名"
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.catRight}>
                {localPremiumCats.has(cat) && (
                  <View style={styles.lockBadge}>
                    <Text style={styles.lockBadgeText}>🔒</Text>
                  </View>
                )}
                <Switch
                  value={localPremiumCats.has(cat)}
                  onValueChange={() => toggleCat(cat)}
                  trackColor={{ false: '#e2e8f0', true: '#fbbf24' }}
                  thumbColor={localPremiumCats.has(cat) ? '#d97706' : '#f1f5f9'}
                />
              </View>
            </View>
          ))}
          <View style={styles.addCatRow}>
            <TextInput
              style={styles.addCatInput}
              value={newCatInput}
              onChangeText={setNewCatInput}
              placeholder="新しいカテゴリ名を入力"
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={[styles.addCatBtn, !newCatInput.trim() && styles.addCatBtnDisabled]}
              onPress={handleAddCategory}
              disabled={!newCatInput.trim()}
            >
              <Text style={styles.addCatBtnText}>＋ 追加</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
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
  addButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addText: {
    color: '#0e7490',
    fontWeight: 'bold',
    fontSize: 14,
  },
  count: {
    color: '#64748b',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 32,
  },
  wordRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  wordInfo: {
    flex: 1,
  },
  katakana: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  english: {
    fontSize: 14,
    color: '#06b6d4',
    marginTop: 2,
  },
  audioBadge: {
    fontSize: 11,
    color: '#22c55e',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editBtnText: {
    color: '#0284c7',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    marginTop: 40,
    fontSize: 15,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0e7490',
  },
  tabText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0e7490',
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  catList: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 8,
  },
  catHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  catRow: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  catName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  catRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  lockBadgeText: {
    fontSize: 11,
    color: '#d97706',
    fontWeight: '700',
  },
  catNameInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 4,
    marginRight: 12,
  },
  addCatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  addCatInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  addCatBtn: {
    backgroundColor: '#0e7490',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addCatBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  addCatBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  searchRow: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
});

function WordList({
  words,
  searchQuery,
  onEdit,
  onDelete,
}: {
  words: WordRow[];
  searchQuery: string;
  onEdit: (word: WordRow) => void;
  onDelete: (word: WordRow) => void;
}) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    return (q
      ? words.filter(w =>
          w.katakana.includes(q) || w.english.toLowerCase().includes(q.toLowerCase()),
        )
      : [...words]
    ).sort((a, b) => a.katakana.localeCompare(b.katakana, 'ja'));
  }, [words, searchQuery]);

  return (
    <>
      <Text style={styles.count}>{filtered.length}件の単語</Text>
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.wordRow}>
            <View style={styles.wordInfo}>
              <Text style={styles.katakana}>{item.katakana}</Text>
              <Text style={styles.english}>{item.english}</Text>
              {item.audio_path && <Text style={styles.audioBadge}>🎤 音声あり</Text>}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.editBtn} onPress={() => onEdit(item)}>
                <Text style={styles.editBtnText}>編集</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item)}>
                <Text style={styles.deleteBtnText}>削除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {searchQuery.trim() ? '該当する単語がありません' : '単語がありません。追加してください。'}
          </Text>
        }
      />
    </>
  );
}
