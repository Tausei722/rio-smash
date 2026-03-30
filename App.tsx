import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
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
import { calcPronunciationScore } from './src/utils/scoring';
import { GameOver } from './src/components/GameOver';
import { MicButton } from './src/components/MicButton';
import { ScoreBoard } from './src/components/ScoreBoard';
import { ScoreReveal } from './src/components/ScoreReveal';
import { WordCard } from './src/components/WordCard';
import { AdminScreen } from './src/screens/AdminScreen';
import { WordFormScreen } from './src/screens/WordFormScreen';

type Screen = 'home' | 'game' | 'gameover' | 'admin' | 'wordform';

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

  // DB初期化
  useEffect(() => {
    (async () => {
      await initDB();
      const rows = await fetchAllWords();
      setAllWords(rows);
      setDbReady(true);
    })();
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

  const handleSamplePressIn = useCallback(async () => {
    if (!currentWordRef.current?.audio_path) return;
    samplePressActiveRef.current = true;
    setIsPlayingSample(true);

    const playLoop = async () => {
      if (!samplePressActiveRef.current) return;
      await audioPlayer.startPlayer(currentWordRef.current!.audio_path!);
      audioPlayer.addPlayBackListener(e => {
        if (e.duration > 0 && e.currentPosition >= e.duration) {
          audioPlayer.removePlayBackListener();
          if (samplePressActiveRef.current) {
            playLoop();
          } else {
            setIsPlayingSample(false);
          }
        }
      });
    };
    playLoop();
  }, []);

  const handleSamplePressOut = useCallback(async () => {
    samplePressActiveRef.current = false;
    await audioPlayer.stopPlayer();
    audioPlayer.removePlayBackListener();
    setIsPlayingSample(false);
  }, []);

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

  const reloadWords = async () => {
    const rows = await fetchAllWords();
    setAllWords(rows);
  };

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
        <Text style={styles.turnText}>プレイヤー {currentPlayer} のターン</Text>
        <WordCard
          katakana={currentWord.katakana}
          english={currentWord.english}
          japanese={currentWord.japanese}
          questionIndex={questionIndex}
          total={gameWords.length}
          showEnglish={reveal !== null}
        />
        <ScoreBoard
          player1Score={player1Score}
          player2Score={player2Score}
          currentPlayer={currentPlayer}
        />
        {currentWord.audio_path && (
          <TouchableOpacity
            style={[styles.sampleButton, isPlayingSample && styles.sampleButtonPlaying]}
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
      </SafeAreaView>
    );
  }

  // --- ホーム画面 ---
  return (
    <HomeScreen
      onStart={startGame}
      onAdmin={() => setScreen('admin')}
      wordCount={allWords.length}
      dbReady={dbReady}
    />
  );
}

function HomeScreen({
  onStart,
  onAdmin,
  wordCount,
  dbReady,
}: {
  onStart: () => void;
  onAdmin: () => void;
  wordCount: number;
  dbReady: boolean;
}) {
  const titlePressCount = useRef(0);
  const titlePressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // タイトルを5回連続タップで管理画面へ
  const handleTitlePress = () => {
    titlePressCount.current += 1;
    if (titlePressTimer.current) clearTimeout(titlePressTimer.current);
    if (titlePressCount.current >= 5) {
      titlePressCount.current = 0;
      onAdmin();
    } else {
      titlePressTimer.current = setTimeout(() => {
        titlePressCount.current = 0;
      }, 2000);
    }
  };

  return (
    <SafeAreaView style={styles.homeScreen}>
      <View style={styles.homeCenter}>
        <TouchableOpacity onPress={handleTitlePress} activeOpacity={1}>
          <Text style={styles.homeEmoji}>🗣️</Text>
          <Text style={styles.homeTitle}>英単語対戦</Text>
        </TouchableOpacity>
        <Text style={styles.homeSubtitle}>
          カタカナ英語を正確に発音して{'\n'}2人で発音精度を競おう！
        </Text>

        <View style={styles.ruleBox}>
          <Text style={styles.ruleItem}>① カタカナ英語が表示される</Text>
          <Text style={styles.ruleItem}>② 🎤 ボタンを押して発音</Text>
          <Text style={styles.ruleItem}>③ 発音の正確さが点数に！</Text>
          <Text style={styles.ruleItem}>④ 合計点数で勝負！</Text>
        </View>

        <Text style={styles.wordCountText}>
          {dbReady ? `📚 ${wordCount}語` : '読み込み中...'}
        </Text>

        <TouchableOpacity
          style={[styles.startButton, !dbReady && styles.startButtonDisabled]}
          onPress={onStart}
          disabled={!dbReady || wordCount === 0}
        >
          <Text style={styles.startButtonText}>スタート</Text>
        </TouchableOpacity>

        {/* 管理ボタン（目立たない小さいボタン） */}
        <TouchableOpacity style={styles.adminHint} onPress={onAdmin}>
          <Text style={styles.adminHintText}>⚙️ 管理者</Text>
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
  turnText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0e7490',
    paddingVertical: 12,
  },
  micArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 32,
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
    fontSize: 40,
    fontWeight: 'bold',
    color: '#0e7490',
    marginBottom: 8,
    textAlign: 'center',
  },
  homeSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
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
});
