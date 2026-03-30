import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteWord, fetchAllWords, WordRow } from '../db/database';

type Props = {
  onBack: () => void;
  onAddWord: () => void;
  onEditWord: (word: WordRow) => void;
};

export function AdminScreen({ onBack, onAddWord, onEditWord }: Props) {
  const [words, setWords] = useState<WordRow[]>([]);

  const load = useCallback(async () => {
    const rows = await fetchAllWords();
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

  return (
    <SafeAreaView style={styles.screen}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>管理者画面</Text>
        <TouchableOpacity onPress={onAddWord} style={styles.addButton}>
          <Text style={styles.addText}>＋ 追加</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.count}>{words.length}件の単語</Text>

      <FlatList
        data={words}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.wordRow}>
            <View style={styles.wordInfo}>
              <Text style={styles.katakana}>{item.katakana}</Text>
              <Text style={styles.english}>{item.english}</Text>
              {item.audio_path && (
                <Text style={styles.audioBadge}>🎤 音声あり</Text>
              )}
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => onEditWord(item)}
              >
                <Text style={styles.editBtnText}>編集</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(item)}
              >
                <Text style={styles.deleteBtnText}>削除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>単語がありません。追加してください。</Text>
        }
      />
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
});
