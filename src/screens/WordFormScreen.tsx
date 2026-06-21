import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { NativeModules } from 'react-native';
import RNFS from 'react-native-fs';
import { insertWord, updateWord, uploadAudio, downloadAudioToLocal, WordRow } from '../db/database';
import { getAudioDuration } from '../native/AudioTrim';
import { AudioTrimmer } from '../components/AudioTrimmer';

const audioRecorderPlayer = AudioRecorderPlayer;

type Props = {
  editingWord?: WordRow | null;
  onBack: () => void;
  onSaved: () => void;
  categories: string[];
};

export function WordFormScreen({ editingWord, onBack, onSaved, categories }: Props) {
  const [katakana, setKatakana] = useState(editingWord?.katakana ?? '');
  const [english, setEnglish] = useState(editingWord?.english ?? '');
  const [japanese, setJapanese] = useState(editingWord?.japanese ?? '');
  const [detail, setDetail] = useState(editingWord?.detail ?? '');
  const [isPremium, setIsPremium] = useState(editingWord?.is_premium ?? false);
  const [category, setCategory] = useState<string | null>(editingWord?.category ?? null);
  const [audioPath, setAudioPath] = useState<string | null>(
    editingWord?.audio_path ?? null,
  );
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);

  const isEdit = !!editingWord;
  // 録音開始時のパスを保持（stopRecorder が失敗しても使えるよう）
  const recordingPathRef = React.useRef<string | null>(null);

  // 音声録音開始/停止
  const handleRecordToggle = async () => {
    if (isRecording) {
      setIsRecording(false);
      let finalPath = recordingPathRef.current;
      recordingPathRef.current = null;
      try {
        // ライブラリ経由で停止を試みる
        const rawPath = await audioRecorderPlayer.stopRecorder();
        const rawStr = typeof rawPath === 'string' ? rawPath : rawPath.filePath;
        finalPath = rawStr.replace(/^file:\/+/, '/');
      } catch {
        // ライブラリが失敗した場合、ネイティブモジュールに直接停止をかける
        // これにより録音ファイルが正しく書き込まれる
        try {
          await NativeModules.AudioRecorderPlayer?.stopRecorder?.();
        } catch {}
      }
      if (finalPath) setAudioPath(finalPath);
    } else {
      try {
        const dir = Platform.OS === 'ios'
          ? RNFS.DocumentDirectoryPath
          : RNFS.ExternalDirectoryPath ?? RNFS.DocumentDirectoryPath;
        const safeName = (english || 'audio').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
        const fileName = `word_${safeName}_${Date.now()}.m4a`;
        const filePath = `${dir}/${fileName}`;

        await audioRecorderPlayer.startRecorder(filePath);
        recordingPathRef.current = filePath;
        setIsRecording(true);
      } catch (e: any) {
        setIsRecording(false);
        recordingPathRef.current = null;
        const msg = e?.message ?? '録音を開始できませんでした';
        const isSessionError = msg.includes('Session activation failed') || msg.includes('session');
        Alert.alert(
          '録音エラー',
          isSessionError
            ? '音声セッションを開始できませんでした。\n通話中や他のアプリが音声を使用していないか確認してください。'
            : msg,
        );
      }
    }
  };

  // 音声再生
  const playTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePlay = async () => {
    if (!audioPath) return;
    if (isPlaying) {
      if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
      await audioRecorderPlayer.stopPlayer();
      setIsPlaying(false);
    } else {
      try {
        setIsPlaying(true);
        const playPath = await downloadAudioToLocal(audioPath);
        let durationMs = 5000;
        try {
          const secs = await getAudioDuration(playPath);
          if (secs > 0) durationMs = Math.ceil(secs * 1000);
        } catch {}
        // startPlayer はローカルファイルに file:// が必要
        const barePath = playPath.replace(/^file:\/+/, '/');
        const playerUri = playPath.startsWith('http') ? playPath : `file://${barePath}`;
        await audioRecorderPlayer.startPlayer(playerUri);
        playTimerRef.current = setTimeout(() => {
          setIsPlaying(false);
          playTimerRef.current = null;
        }, durationMs + 300);
      } catch (e: any) {
        setIsPlaying(false);
        Alert.alert('再生エラー', e?.message ?? '音声を再生できませんでした');
      }
    }
  };

  // 保存（ローカル音声があればSupabase Storageにアップロード）
  const handleSave = async () => {
    if (!katakana.trim() || !english.trim()) {
      Alert.alert('入力エラー', 'カタカナと英語の両方を入力してください。');
      return;
    }
    setIsSaving(true);
    try {
      let finalAudioPath = audioPath;

      // ローカルパス（file://なし）の場合はStorageにアップロード
      if (audioPath && !audioPath.startsWith('http')) {
        finalAudioPath = await uploadAudio(audioPath, english.trim());
      }

      if (isEdit && editingWord) {
        await updateWord(editingWord.id, katakana.trim(), english.trim(), japanese.trim() || null, detail.trim() || null, finalAudioPath, isPremium, category);
      } else {
        await insertWord(katakana.trim(), english.trim(), japanese.trim() || undefined, detail.trim() || undefined, finalAudioPath ?? undefined, isPremium, category ?? undefined);
      }
      onSaved();
    } catch (e: any) {
      const msg = [
        e?.message,
        e?.code,
        e?.details,
        e?.hint,
        JSON.stringify(e),
      ].filter(Boolean).join('\n');
      Alert.alert('エラー詳細', msg || '不明なエラー');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isEdit ? '単語を編集' : '単語を追加'}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* カタカナ入力 */}
        <Text style={styles.label}>カタカナ英語</Text>
        <TextInput
          style={styles.input}
          value={katakana}
          onChangeText={setKatakana}
          placeholder="例：スマート"
          placeholderTextColor="#94a3b8"
        />

        {/* 英語入力 */}
        <Text style={styles.label}>英語（正解）</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={english}
          onChangeText={setEnglish}
          placeholder="例：smart / I love you"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          multiline
        />

        {/* 日本語訳入力 */}
        <Text style={styles.label}>日本語訳（任意）</Text>
        <TextInput
          style={styles.input}
          value={japanese}
          onChangeText={setJapanese}
          placeholder="例：賢い / 愛しています"
          placeholderTextColor="#94a3b8"
        />

        {/* 詳細・文法メモ */}
        <Text style={styles.label}>詳細・文法メモ（任意）</Text>
        <TextInput
          style={[styles.input, styles.inputDetail]}
          value={detail}
          onChangeText={setDetail}
          placeholder={'【品詞】形容詞\n【意味】賢い\n【使い方】\nShe is smart.\n【文法ポイント】\nbe動詞の後に置く。'}
          placeholderTextColor="#94a3b8"
          multiline
          textAlignVertical="top"
        />

        {/* プレミアム設定 */}
        <View style={styles.premiumRow}>
          <View>
            <Text style={styles.label}>プレミアム単語</Text>
            <Text style={styles.premiumHint}>ONにするとプレミアムユーザーのみ表示</Text>
          </View>
          <Switch
            value={isPremium}
            onValueChange={setIsPremium}
            trackColor={{ false: '#e2e8f0', true: '#06b6d4' }}
            thumbColor={isPremium ? '#0e7490' : '#94a3b8'}
          />
        </View>

        {/* カテゴリ選択 */}
        <Text style={styles.label}>カテゴリ（任意）</Text>
        <View style={styles.categoryGrid}>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
              onPress={() => setCategory(category === cat ? null : cat)}
            >
              <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 音声録音セクション */}
        <Text style={styles.label}>参考音声（正しい発音を録音）</Text>
        <View style={styles.audioSection}>
          <TouchableOpacity
            style={[styles.audioBtn, isRecording && styles.audioBtnRecording]}
            onPress={handleRecordToggle}
          >
            <Text style={styles.audioBtnText}>
              {isRecording ? '⏹ 録音停止' : '🎤 録音開始'}
            </Text>
          </TouchableOpacity>

          {audioPath && (
            <TouchableOpacity
              style={[styles.audioBtn, styles.audioBtnPlay, isPlaying && styles.audioBtnPlaying]}
              onPress={handlePlay}
            >
              <Text style={styles.audioBtnText}>
                {isPlaying ? '⏹ 停止' : '▶ 再生'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {audioPath ? (
          <>
            <Text style={styles.audioStatus}>✅ 音声が録音されています</Text>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.trimButton, isDownloading && styles.saveButtonDisabled]}
                disabled={isDownloading}
                onPress={async () => {
                  if (audioPath.startsWith('http')) {
                    setIsDownloading(true);
                    try {
                      const dest = await downloadAudioToLocal(audioPath);
                      setLocalAudioPath(dest);
                      setShowTrimmer(true);
                    } catch (e: any) {
                      Alert.alert('エラー', '音声のダウンロードに失敗しました');
                    } finally {
                      setIsDownloading(false);
                    }
                  } else {
                    setLocalAudioPath(audioPath);
                    setShowTrimmer(true);
                  }
                }}
              >
                {isDownloading ? (
                  <ActivityIndicator color="#475569" size="small" />
                ) : (
                  <Text style={styles.trimButtonText}>✂️ トリム（前後カット）</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={styles.audioHint}>（任意）参考音声がなくても保存できます</Text>
        )}

        <Modal visible={showTrimmer} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            {localAudioPath && (
              <AudioTrimmer
                audioPath={localAudioPath}
                onTrimmed={newPath => {
                  setAudioPath(newPath);
                  setLocalAudioPath(newPath);
                  setShowTrimmer(false);
                }}
                onCancel={() => setShowTrimmer(false)}
              />
            )}
          </View>
        </Modal>

        {/* 保存ボタン */}
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEdit ? '更新する' : '追加する'}
            </Text>
          )}
        </TouchableOpacity>
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
  backButton: { padding: 4 },
  backText: { color: '#ffffff', fontSize: 15 },
  title: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
  body: {
    padding: 24,
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#0f172a',
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputDetail: {
    minHeight: 120,
    fontSize: 14,
    lineHeight: 22,
  },
  audioSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  audioBtn: {
    flex: 1,
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  audioBtnRecording: {
    backgroundColor: '#ef4444',
  },
  audioBtnPlay: {
    backgroundColor: '#22c55e',
  },
  audioBtnPlaying: {
    backgroundColor: '#f59e0b',
  },
  audioBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  audioStatus: {
    color: '#22c55e',
    fontSize: 13,
    marginTop: 4,
  },
  audioHint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
  },
  premiumHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  trimButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  trimButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
  },
  saveButton: {
    backgroundColor: '#0e7490',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#0e7490',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipSelected: {
    backgroundColor: '#D75F1B',
    borderColor: '#D75F1B',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  categoryChipTextSelected: {
    color: '#ffffff',
  },
});
