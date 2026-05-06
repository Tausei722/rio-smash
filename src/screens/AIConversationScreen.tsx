import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// import Tts from 'react-native-tts';
const Tts = { speak: (_text: string) => {}, stop: () => {} };
import Voice, { SpeechResultsEvent } from '@react-native-voice/voice';
import { ANTHROPIC_API_KEY } from '../config/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPT =
  'You are having a casual daily English conversation. Keep your replies natural and concise (1–3 sentences). Use simple vocabulary suitable for English learners.';

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'assistant',
  content: "Hi! Let's chat in English. How are you doing today?",
};

type Props = {
  onBack: () => void;
};

export function AIConversationScreen({ onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [liveWords, setLiveWords] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const isRecordingRef = useRef(false);
  const isMountedRef = useRef(true);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SILENCE_TIMEOUT_MS = 3000; // 3秒無音でオフ

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

  // TTS + Voice まとめて初期化・クリーンアップ
  useEffect(() => {
    isMountedRef.current = true;
    Tts.setDefaultLanguage('en-US');

    Tts.addEventListener('tts-finish', () => {
      if (isMountedRef.current) setPlayingId(null);
    });

    // 初回メッセージを自動再生
    const timer = setTimeout(
      () => speakText(INITIAL_MESSAGE.id, INITIAL_MESSAGE.content),
      600,
    );

    // Voice ハンドラ
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      const text = e.value?.[0] ?? '';
      setLiveWords(text.trim() ? text.trim().split(/\s+/) : []);
      // 音声検知のたびに無音タイマーをリセット
      resetSilenceTimer();
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (!isMountedRef.current) return;
      const text = e.value?.[0] ?? '';
      setLiveWords([]);
      if (text) setInputText(text);
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
      clearTimeout(timer);
      // TTS 停止
      try { Tts.stop(); } catch {}
      Tts.removeAllListeners('tts-finish');
      // Voice 停止してから破棄
      clearSilenceTimer();
      const cleanup = async () => {
        try {
          if (isRecordingRef.current) await Voice.stop();
        } catch {}
        try { await Voice.destroy(); } catch {}
        Voice.removeAllListeners();
      };
      cleanup();
    };
  }, []);

  const speakText = (id: string, text: string) => {
    Tts.stop();
    setPlayingId(id);
    Tts.speak(text);
  };

  const handleMicPress = async () => {
    if (isRecordingRef.current) {
      clearSilenceTimer();
      isRecordingRef.current = false;
      setIsRecording(false);
      setLiveWords([]);
      await Voice.stop();
    } else {
      try {
        setInputText('');
        setLiveWords([]);
        await Voice.start('en-US');
        isRecordingRef.current = true;
        setIsRecording(true);
        resetSilenceTimer(); // 録音開始と同時に無音タイマー起動
      } catch {
        Alert.alert('マイクエラー', '音声認識を開始できませんでした');
      }
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
    };

    const updated = [...messages, userMessage];
    setMessages(updated);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'API error');

      const aiContent: string = data.content[0].text;
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiContent,
      };

      setMessages(prev => [...prev, aiMessage]);
      // AI の返答を自動再生
      speakText(aiMessage.id, aiContent);
    } catch (e: any) {
      Alert.alert('エラー', e.message ?? '送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isAI = item.role === 'assistant';
    const isPlaying = playingId === item.id;

    return (
      <View style={[styles.messageRow, isAI ? styles.messageRowAI : styles.messageRowUser]}>
        {isAI && <Text style={styles.avatar}>🤖</Text>}
        <View style={[styles.bubble, isAI ? styles.bubbleAI : styles.bubbleUser]}>
          <Text style={[styles.bubbleText, isAI ? styles.bubbleTextAI : styles.bubbleTextUser]}>
            {item.content}
          </Text>
          {isAI && (
            <TouchableOpacity
              style={[styles.playBtn, isPlaying && styles.playBtnActive]}
              onPress={() => speakText(item.id, item.content)}
            >
              <Text style={styles.playBtnText}>
                {isPlaying ? '🔊 再生中' : '▶ 再生'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backText}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>🤖 AI英語練習</Text>
          <Text style={styles.headerSub}>日常英会話モード</Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      {/* チャット */}
      <KeyboardAvoidingView
        style={styles.chatArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {isLoading && (
          <View style={styles.typingArea}>
            <ActivityIndicator size="small" color="#06b6d4" />
            <Text style={styles.typingText}>AIが入力中...</Text>
          </View>
        )}

        {/* リアルタイム音声表示 */}
        {isRecording && (
          <View style={styles.liveArea}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>認識中</Text>
            </View>
            <View style={styles.liveWordsRow}>
              {liveWords.length === 0 ? (
                <Text style={styles.livePlaceholder}>話してください...</Text>
              ) : (
                liveWords.map((word, i) => {
                  const isCurrent = i === liveWords.length - 1;
                  return (
                    <Text
                      key={i}
                      style={[styles.liveWord, isCurrent && styles.liveWordCurrent]}
                    >
                      {word}{' '}
                    </Text>
                  );
                })
              )}
            </View>
          </View>
        )}

        {/* 入力エリア */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            onPress={handleMicPress}
          >
            <Text style={styles.micBtnText}>{isRecording ? '⏹' : '🎤'}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="英語で入力..."
            placeholderTextColor="#94a3b8"
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            <Text style={styles.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f0fdfe',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0e7490',
  },
  backBtn: { padding: 4 },
  backText: { color: '#ffffff', fontSize: 15 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  headerSub: { color: '#a5f3fc', fontSize: 11, marginTop: 1 },
  chatArea: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowAI: {
    justifyContent: 'flex-start',
  },
  messageRowUser: {
    justifyContent: 'flex-end',
  },
  avatar: {
    fontSize: 28,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    padding: 12,
  },
  bubbleAI: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: '#0e7490',
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextAI: {
    color: '#1e293b',
  },
  bubbleTextUser: {
    color: '#ffffff',
  },
  playBtn: {
    marginTop: 8,
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  playBtnActive: {
    backgroundColor: '#bae6fd',
  },
  playBtnText: {
    color: '#0284c7',
    fontSize: 12,
    fontWeight: '600',
  },
  typingArea: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  typingText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 8,
  },
  micBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#e0f2fe',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnActive: {
    backgroundColor: '#fecaca',
  },
  micBtnText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    backgroundColor: '#0e7490',
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  liveArea: {
    marginHorizontal: 12,
    marginBottom: 6,
    backgroundColor: '#0e7490',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f87171',
  },
  liveLabel: {
    color: '#a5f3fc',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
  },
  liveWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    minHeight: 32,
  },
  livePlaceholder: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontStyle: 'italic',
  },
  liveWord: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 18,
    fontWeight: '400',
  },
  liveWordCurrent: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
