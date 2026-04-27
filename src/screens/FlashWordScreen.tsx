import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice';

type Props = {
  onBack: () => void;
};

const SILENCE_TIMEOUT_MS = 3000;

export function FlashWordScreen({ onBack }: Props) {
  const [liveWords, setLiveWords] = useState<string[]>([]);
  const [history, setHistory] = useState<string[][]>([]); // 確定した発話の履歴
  const [isRecording, setIsRecording] = useState(false);

  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(async () => {
      if (!isRecordingRef.current || !isMountedRef.current) return;
      isRecordingRef.current = false;
      setIsRecording(false);
      setLiveWords([]);
      try { await Voice.stop(); } catch {}
    }, SILENCE_TIMEOUT_MS);
  };

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      const text = e.value?.[0] ?? '';
      setLiveWords(text.trim() ? text.trim().split(/\s+/) : []);
      resetSilenceTimer();
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      const text = e.value?.[0] ?? '';
      if (text.trim()) {
        const words = text.trim().split(/\s+/);
        setHistory(prev => [...prev, words]);
      }
      setLiveWords([]);
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    Voice.onSpeechEnd = () => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      isRecordingRef.current = false;
      setIsRecording(false);
    };

    Voice.onSpeechError = () => {
      if (!isMountedRef.current) return;
      clearSilenceTimer();
      isRecordingRef.current = false;
      setIsRecording(false);
      setLiveWords([]);
    };

    return () => {
      isMountedRef.current = false;
      clearSilenceTimer();
      const cleanup = async () => {
        try { if (isRecordingRef.current) await Voice.stop(); } catch {}
        try { await Voice.destroy(); } catch {}
        Voice.removeAllListeners();
      };
      cleanup();
    };
  }, []);

  const handleMicPress = async () => {
    if (isRecordingRef.current) {
      clearSilenceTimer();
      isRecordingRef.current = false;
      setIsRecording(false);
      setLiveWords([]);
      try { await Voice.stop(); } catch {}
    } else {
      try {
        setLiveWords([]);
        await Voice.start('en-US');
        isRecordingRef.current = true;
        setIsRecording(true);
        resetSilenceTimer();
      } catch {
        Alert.alert('マイクエラー', '音声認識を開始できませんでした');
      }
    }
  };

  const currentWord = liveWords.length > 0 ? liveWords[liveWords.length - 1] : null;
  const prevWords = liveWords.length > 1 ? liveWords.slice(0, -1) : [];

  return (
    <SafeAreaView style={styles.screen}>

      {/* 戻るボタン・録音インジケーター（オーバーレイ） */}
      <View style={styles.topOverlay}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingLabel}>認識中</Text>
          </View>
        )}
      </View>

      {/* 画面全体：現在の単語を中央に超大表示 */}
      <View style={styles.fullScreen}>
        {isRecording ? (
          currentWord ? (
            <Text
              style={styles.currentWord}
              adjustsFontSizeToFit
              numberOfLines={1}
            >
              {currentWord}
            </Text>
          ) : (
            <Text style={styles.waitingText}>話してください...</Text>
          )
        ) : (
          <View style={styles.idleArea}>
            <Text style={styles.idleEmoji}>🎤</Text>
            <Text style={styles.idleText}>
              ボタンを押して{'\n'}英語を話してください
            </Text>
          </View>
        )}
      </View>

      {/* 直前の単語（画面下部に薄く） */}
      {isRecording && prevWords.length > 0 && (
        <View style={styles.prevWordsRow}>
          {prevWords.slice(-6).map((w, i) => (
            <Text key={i} style={styles.prevWord}>{w} </Text>
          ))}
        </View>
      )}

      {/* 発話履歴 */}
      {!isRecording && history.length > 0 && (
        <View style={styles.historyArea}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>履歴</Text>
            <TouchableOpacity onPress={() => setHistory([])}>
              <Text style={styles.historyClear}>クリア</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.historyScroll} showsVerticalScrollIndicator={false}>
            {[...history].reverse().map((words, i) => (
              <View key={i} style={styles.historyRow}>
                {words.map((w, j) => (
                  <Text key={j} style={styles.historyWord}>{w} </Text>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* MICボタン */}
      <View style={styles.micArea}>
        <TouchableOpacity
          style={[styles.micBtn, isRecording && styles.micBtnActive]}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <Text style={styles.micBtnEmoji}>{isRecording ? '⏹' : '🎤'}</Text>
          <Text style={styles.micBtnLabel}>
            {isRecording ? '停止' : 'スタート'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  topOverlay: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  backBtn: { padding: 8 },
  backText: { color: 'rgba(255,255,255,0.5)', fontSize: 15 },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  recordingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f87171',
  },
  recordingLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },

  // 画面全体を使って現在の単語を表示
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  currentWord: {
    fontSize: 96,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -2,
    textShadowColor: '#06b6d4',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  waitingText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.25)',
    fontStyle: 'italic',
  },
  idleArea: {
    alignItems: 'center',
    gap: 20,
  },
  idleEmoji: {
    fontSize: 80,
    opacity: 0.2,
  },
  idleText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    lineHeight: 30,
  },

  // 直前の単語を下部に薄く並べる
  prevWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    gap: 4,
  },
  prevWord: {
    fontSize: 22,
    color: 'rgba(255,255,255,0.25)',
    fontWeight: '500',
  },

  historyArea: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    padding: 14,
    maxHeight: 130,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  historyClear: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
  },
  historyScroll: {},
  historyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  historyWord: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
  },

  micArea: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  micBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
  },
  micBtnEmoji: {
    fontSize: 30,
  },
  micBtnLabel: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
