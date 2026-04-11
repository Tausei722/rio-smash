import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';

import { fetchAllWords, initDB, WordRow } from './src/db/database';
import { supabase } from './src/db/supabase';
import { getAudioDuration } from './src/native/AudioTrim';
import { calcPronunciationScore } from './src/utils/scoring';
import { GameOver } from './src/components/GameOver';
import { MicButton } from './src/components/MicButton';
import { ScoreBoard } from './src/components/ScoreBoard';
import { ScoreReveal } from './src/components/ScoreReveal';
import { WordCard } from './src/components/WordCard';
import { AdminScreen } from './src/screens/AdminScreen';
import { AIConversationScreen } from './src/screens/AIConversationScreen';
import { FlashWordScreen } from './src/screens/FlashWordScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WordFormScreen } from './src/screens/WordFormScreen';

type Screen = 'home' | 'game' | 'gameover' | 'admin' | 'wordform' | 'ai' | 'flash';

// AudioRecorderPlayer はすでにインスタンスとして export されている
const audioPlayer = AudioRecorderPlayer;

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#ecfeff" />
      <GameApp />
    </SafeAreaProvider>
  );
}

function GameApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [dbReady, setDbReady] = useState(false);
  const [allWords, setAllWords] = useState<WordRow[]>([]);
  const [gameWords, setGameWords] = useState<WordRow[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [reveal, setReveal] = useState<{ score: number; spoken: string } | null>(null);
  const [editingWord, setEditingWord] = useState<WordRow | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // セッション確認 & isAdmin 取得
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      setAuthReady(true);
      return;
    }
    setIsLoggedIn(true);
    const { data } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();
    setIsAdmin(data?.is_admin === true);
    setAuthReady(true);
  };

  // DB初期化 & 認証確認
  useEffect(() => {
    (async () => {
      await initDB();
      const rows = await fetchAllWords();
      setAllWords(rows);
      setDbReady(true);
    })();
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIsLoggedIn(false);
        setIsAdmin(false);
        setScreen('home');
      } else {
        setIsLoggedIn(true);
        checkAuth();
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const currentWord = gameWords[questionIndex];
  const isLastQuestion = questionIndex >= gameWords.length - 1;

  // stale closure回避: currentWordをrefで保持
  const currentWordRef = useRef(currentWord);
  useEffect(() => { currentWordRef.current = currentWord; }, [currentWord]);

  // 実際の録音状態をrefで管理（UIのisRecordingと分離）
  const isRecordingRef = useRef(false);
  // 連打防止フラグ
  const isProcessingRef = useRef(false);
  // 手動停止フラグ
  const isManualStopRef = useRef(false);
  // 認識テキスト蓄積（手動停止まで上書き更新）
  const latestSpokenRef = useRef('');

  // Voiceイベントはマウント時に1回だけ登録
  useEffect(() => {
    // リアルタイム部分認識 → 表示更新 + 蓄積
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? '';
      setLiveText(text);
      if (text) latestSpokenRef.current = text;
    };

    // 確定テキスト → 蓄積のみ（判断は onSpeechEnd に任せる）
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const spoken = e.value?.[0] ?? '';
      if (spoken) {
        latestSpokenRef.current = spoken;
        setLiveText(spoken);
      }
    };

    // セッション終了 → 手動停止なら確定、そうでなければ再スタート
    Voice.onSpeechEnd = () => {
      if (!isRecordingRef.current) return; // すでに停止済みなら何もしない

      if (isManualStopRef.current) {
        // 手動停止 → スコア確定
        isRecordingRef.current = false;
        isProcessingRef.current = false;
        setIsRecording(false);
        setLiveText('');
        const word = currentWordRef.current;
        const finalText = latestSpokenRef.current;
        latestSpokenRef.current = '';
        isManualStopRef.current = false;
        if (!word) return;
        if (!finalText) {
          Alert.alert('エラー', '音声を認識できませんでした。もう一度試してください。');
          return;
        }
        const score = calcPronunciationScore(finalText, word.english);
        setReveal({ score, spoken: finalText });
      } else {
        // iOSがサイレンスで自動停止 → 再スタートして聞き続ける
        Voice.start('en-US').catch(() => {
          isRecordingRef.current = false;
          isProcessingRef.current = false;
          setIsRecording(false);
        });
      }
    };

    // エラー → 録音中なら再スタート、停止中ならアラート
    Voice.onSpeechError = (_e: SpeechErrorEvent) => {
      if (isRecordingRef.current && !isManualStopRef.current) {
        // 自動再スタート中のエラー → 黙って再試行
        Voice.start('en-US').catch(() => {
          isRecordingRef.current = false;
          isProcessingRef.current = false;
          setIsRecording(false);
        });
      } else {
        isRecordingRef.current = false;
        isProcessingRef.current = false;
        isManualStopRef.current = false;
        latestSpokenRef.current = '';
        setIsRecording(false);
        Alert.alert('エラー', '音声を認識できませんでした。もう一度試してください。');
      }
    };
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []); // マウント/アンマウント時のみ

  const handleMicPress = useCallback(async () => {
    if (isProcessingRef.current) return; // 連打ガード
    isProcessingRef.current = true;

    try {
      if (isRecordingRef.current) {
        // 手動停止
        isManualStopRef.current = true;
        await Voice.stop();
      } else {
        // 開始 → 成功してからstateを更新
        isManualStopRef.current = false;
        await Voice.start('en-US');
        isRecordingRef.current = true;
        setIsRecording(true);
      }
    } catch {
      isRecordingRef.current = false;
      setIsRecording(false);
      Alert.alert('エラー', 'マイクを開始できませんでした。');
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  const handleNext = useCallback(async () => {
    if (!reveal) return;
    // 条件に関係なく常にVoiceセッションをキャンセルして確実に停止
    try { await Voice.cancel(); } catch {}
    isRecordingRef.current = false;
    isProcessingRef.current = false;
    isManualStopRef.current = false;
    latestSpokenRef.current = '';
    setIsRecording(false);
    if (currentPlayer === 1) setPlayer1Score(p => p + reveal.score);
    else setPlayer2Score(p => p + reveal.score);
    setReveal(null);
    setLiveText('');
    if (isLastQuestion) {
      setScreen('gameover');
    } else {
      setQuestionIndex(i => i + 1);
      setCurrentPlayer(p => (p === 1 ? 2 : 1));
    }
  }, [reveal, currentPlayer, isLastQuestion]);

  // 長押し中はループ再生
  const samplePressActiveRef = useRef(false);
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSamplePressIn = useCallback(async () => {
    if (!currentWordRef.current?.audio_path) return;
    samplePressActiveRef.current = true;
    setIsPlayingSample(true);

    const path = currentWordRef.current.audio_path;

    // 音声の長さを取得してタイマーでループ管理（リスナー不使用）
    let durationMs = 3000;
    try {
      const secs = await getAudioDuration(path);
      if (secs > 0) durationMs = Math.ceil(secs * 1000);
    } catch {}

    const startLoop = () => {
      if (!samplePressActiveRef.current) {
        setIsPlayingSample(false);
        return;
      }
      audioPlayer.startPlayer(path);
      loopTimerRef.current = setTimeout(startLoop, durationMs + 300);
    };

    startLoop();
  }, []);

  const handleSamplePressOut = useCallback(async () => {
    samplePressActiveRef.current = false;
    if (loopTimerRef.current !== null) {
      clearTimeout(loopTimerRef.current);
      loopTimerRef.current = null;
    }
    await audioPlayer.stopPlayer();
    audioPlayer.removePlayBackListener();
    setIsPlayingSample(false);
  }, []);

  const handleDeleteAccount = () => {
    Alert.alert(
      'アカウントを削除',
      'アカウントを完全に削除しますか？\nこの操作は取り消せません。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              '本当に削除しますか？',
              'すべてのデータが失われます。',
              [
                { text: 'キャンセル', style: 'cancel' },
                {
                  text: '完全に削除する',
                  style: 'destructive',
                  onPress: async () => {
                    const { error } = await supabase.rpc('delete_account');
                    if (error) {
                      Alert.alert('エラー', 'アカウントの削除に失敗しました。\n' + error.message);
                    } else {
                      await supabase.auth.signOut();
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const startGame = () => {
    // 録音中だった場合も確実にリセット
    if (isRecordingRef.current) {
      Voice.stop().catch(() => {});
    }
    isRecordingRef.current = false;
    isProcessingRef.current = false;
    isManualStopRef.current = false;
    latestSpokenRef.current = '';
    const words = shuffleArray(allWords).slice(0, Math.min(10, allWords.length));
    setGameWords(words);
    setQuestionIndex(0);
    setCurrentPlayer(1);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setReveal(null);
    setIsRecording(false);
    setIsPlayingSample(false);
    setScreen('game');
  };

  const handleQuitGame = () => {
    Alert.alert(
      'ゲームをやめますか？',
      'スコアはリセットされます。',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'やめる',
          style: 'destructive',
          onPress: async () => {
            // 録音中なら停止
            if (isRecordingRef.current) {
              try { await Voice.stop(); } catch {}
            }
            isRecordingRef.current = false;
            isProcessingRef.current = false;
            isManualStopRef.current = false;
            setIsRecording(false);
            // サンプル再生中なら停止
            samplePressActiveRef.current = false;
            if (loopTimerRef.current !== null) {
              clearTimeout(loopTimerRef.current);
              loopTimerRef.current = null;
            }
            try { await audioPlayer.stopPlayer(); } catch {}
            audioPlayer.removePlayBackListener();
            setIsPlayingSample(false);
            setReveal(null);
            setScreen('home');
          },
        },
      ],
    );
  };

  const reloadWords = async () => {
    const rows = await fetchAllWords();
    setAllWords(rows);
  };

  // --- 認証ローディング ---
  if (!authReady) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#0e7490', fontSize: 16 }}>読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- ログイン画面 ---
  if (!isLoggedIn) {
    return <LoginScreen onLoggedIn={checkAuth} />;
  }

  // --- AI英語練習 ---
  if (screen === 'ai') {
    return <AIConversationScreen onBack={() => setScreen('home')} />;
  }

  // --- フラッシュ英単語 ---
  if (screen === 'flash') {
    return <FlashWordScreen onBack={() => setScreen('home')} />;
  }

  // --- Admin ナビゲーション ---
  if (screen === 'admin') {
    return (
      <AdminScreen
        onBack={() => { reloadWords(); setScreen('home'); }}
        onAddWord={() => { setEditingWord(null); setScreen('wordform'); }}
        onEditWord={word => { setEditingWord(word); setScreen('wordform'); }}
      />
    );
  }

  if (screen === 'wordform') {
    return (
      <WordFormScreen
        editingWord={editingWord}
        onBack={() => setScreen('admin')}
        onSaved={() => { reloadWords(); setScreen('admin'); }}
      />
    );
  }

  // --- ゲームオーバー ---
  if (screen === 'gameover') {
    return (
      <GameOver
        player1Score={player1Score}
        player2Score={player2Score}
        onRestart={startGame}
      />
    );
  }

  // --- ゲーム画面 ---
  if (screen === 'game' && currentWord) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.gameHeader}>
          <Text style={styles.turnText}>プレイヤー {currentPlayer} のターン</Text>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuitGame}>
            <Text style={styles.quitButtonText}>✕ やめる</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.gameScroll} keyboardShouldPersistTaps="handled">
          <WordCard
            katakana={currentWord.katakana}
            english={currentWord.english}
            japanese={currentWord.japanese}
            questionIndex={questionIndex}
            total={gameWords.length}
            showEnglish={reveal !== null}
          />
          {!isRecording && (
            <ScoreBoard
              player1Score={player1Score}
              player2Score={player2Score}
              currentPlayer={currentPlayer}
            />)
          }
          {currentWord.audio_path && (
            <TouchableOpacity
              style={[styles.sampleButton, isPlayingSample && styles.sampleButtonPlaying, isRecording && styles.hiden]}
              onPressIn={handleSamplePressIn}
              onPressOut={handleSamplePressOut}
              disabled={isRecording}
              activeOpacity={0.7}
            >
              <Text style={styles.sampleButtonText}>
                {isPlayingSample ? '🔊 再生中...' : '🔊 長押しで見本を聞く'}
              </Text>
            </TouchableOpacity>
          )}
          <View style={styles.micArea}>
            {isRecording && (
              <View style={styles.liveTextBox}>
                <Text style={styles.liveTextLabel}>認識中...</Text>
                <Text style={styles.liveText}>{liveText || '　'}</Text>
              </View>
            )}
            <MicButton
              isRecording={isRecording}
              onPress={handleMicPress}
              disabled={reveal !== null}
            />
          </View>
          {reveal && (
            <ScoreReveal
              score={reveal.score}
              spokenText={reveal.spoken}
              expectedWord={currentWord.english}
              japanese={currentWord.japanese}
              detail={currentWord.detail}
              currentPlayer={currentPlayer}
              onNext={handleNext}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- ホーム画面 ---
  return (
    <HomeScreen
      onStartBattle={startGame}
      onStartAI={() => setScreen('ai')}
      onStartFlash={() => setScreen('flash')}
      onAdmin={() => setScreen('admin')}
      onLogout={() => supabase.auth.signOut()}
      onDeleteAccount={handleDeleteAccount}
      wordCount={allWords.length}
      dbReady={dbReady}
      isAdmin={isAdmin}
    />
  );
}

function HomeScreen({
  onStartBattle,
  onStartAI,
  onStartFlash,
  onAdmin,
  onLogout,
  onDeleteAccount,
  wordCount,
  dbReady,
  isAdmin,
}: {
  onStartBattle: () => void;
  onStartAI: () => void;
  onStartFlash: () => void;
  onAdmin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  wordCount: number;
  dbReady: boolean;
  isAdmin: boolean;
}) {
  return (
    <SafeAreaView style={styles.homeScreen}>
      <View style={styles.homeHeader}>
        <View>
          <Text style={styles.homeTitle}>英単語対戦</Text>
          <Text style={styles.homeSubtitle}>モードを選んでスタート</Text>
        </View>
        <View style={styles.homeHeaderRight}>
          {isAdmin && (
            <TouchableOpacity style={styles.adminHint} onPress={onAdmin}>
              <Text style={styles.adminHintText}>⚙️</Text>
            </TouchableOpacity>
          )}
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>ログアウト</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteAccountButton} onPress={onDeleteAccount}>
            <Text style={styles.deleteAccountButtonText}>アカウント削除</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.modeList}>
        {/* 2人対戦モード */}
        <TouchableOpacity
          style={[styles.modeCard, (!dbReady || wordCount === 0) && styles.modeCardDisabled]}
          onPress={onStartBattle}
          disabled={!dbReady || wordCount === 0}
          activeOpacity={0.85}
        >
          <View style={styles.modeCardInner}>
            <Text style={styles.modeEmoji}>⚔️</Text>
            <View style={styles.modeTextArea}>
              <Text style={styles.modeTitle}>2人対戦</Text>
              <Text style={styles.modeDesc}>
                カタカナ英語を発音して{'\n'}2人で精度を競おう
              </Text>
              <Text style={styles.modeWordCount}>
                {dbReady ? `📚 ${wordCount}語` : '読み込み中...'}
              </Text>
            </View>
            <Text style={styles.modeArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* AI英語モード */}
        <TouchableOpacity
          style={styles.modeCard}
          onPress={onStartAI}
          activeOpacity={0.85}
        >
          <View style={styles.modeCardInner}>
            <Text style={styles.modeEmoji}>🤖</Text>
            <View style={styles.modeTextArea}>
              <Text style={styles.modeTitle}>AI英語練習</Text>
              <Text style={styles.modeDesc}>
                AIと一緒に英語を練習しよう
              </Text>
              <View style={styles.modeBadge}>
                <Text style={styles.modeBadgeText}>NEW</Text>
              </View>
            </View>
            <Text style={styles.modeArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* フラッシュ英単語モード */}
        <TouchableOpacity
          style={styles.modeCard}
          onPress={onStartFlash}
          activeOpacity={0.85}
        >
          <View style={styles.modeCardInner}>
            <Text style={styles.modeEmoji}>⚡</Text>
            <View style={styles.modeTextArea}>
              <Text style={styles.modeTitle}>フラッシュ英単語</Text>
              <Text style={styles.modeDesc}>
                話した単語をリアルタイム表示{'\n'}現在の単語を強調表示
              </Text>
            </View>
            <Text style={styles.modeArrow}>›</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ecfeff',
    paddingTop: Platform.OS === 'android' ? 8 : 0,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  quitButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  quitButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
  },
  turnText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0e7490',
    paddingVertical: 12,
  },
  gameScroll: {
    paddingBottom: 40,
  },
  micArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  liveTextBox: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    alignItems: 'center',
    minWidth: 200,
  },
  liveTextLabel: {
    fontSize: 11,
    color: '#06b6d4',
    fontWeight: '600',
    marginBottom: 4,
  },
  liveText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  sampleButton: {
    alignSelf: 'center',
    backgroundColor: '#e0f2fe',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 12,
  },
  sampleButtonPlaying: {
    backgroundColor: '#fef3c7',
  },
  sampleButtonText: {
    color: '#0284c7',
    fontSize: 15,
    fontWeight: '600',
  },
  homeScreen: {
    flex: 1,
    backgroundColor: '#ecfeff',
  },
  homeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  homeEmoji: {
    fontSize: 64,
    textAlign: 'center',
    marginBottom: 8,
  },
  homeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#0e7490',
  },
  homeSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
    marginBottom: 0,
  },
  ruleBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  ruleItem: {
    fontSize: 15,
    color: '#334155',
  },
  wordCountText: {
    color: '#64748b',
    fontSize: 13,
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#06b6d4',
    paddingVertical: 16,
    paddingHorizontal: 72,
    borderRadius: 32,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  adminHint: {
    marginTop: 24,
    padding: 8,
  },
  adminHintText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  logoutButton: {
    marginTop: 12,
    padding: 8,
  },
  logoutButtonText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  homeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 16,
  },
  modeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  modeCardDisabled: {
    opacity: 0.5,
  },
  modeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  modeEmoji: {
    fontSize: 44,
  },
  modeTextArea: {
    flex: 1,
    gap: 4,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0e7490',
  },
  modeDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  modeWordCount: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  modeArrow: {
    fontSize: 28,
    color: '#cbd5e1',
    fontWeight: '300',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#06b6d4',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  modeBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  hiden: {
    display: 'none',
  },
  deleteAccountButton: {
    marginTop: 4,
    padding: 8,
  },
  deleteAccountButtonText: {
    color: '#ef4444',
    fontSize: 12,
  },
});
