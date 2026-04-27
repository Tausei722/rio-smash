import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';

import { fetchAllWords, initDB, downloadAudioToLocal, WordRow, CATEGORIES } from './src/db/database';
import { supabase } from './src/db/supabase';
import {
  setupIAP,
  setupPurchaseListeners,
  purchasePremium,
  restorePremium,
  activatePremium,
} from './src/services/purchase';
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

const CATEGORY_EMOJI: Record<string, string> = {
  'yesterday':    '📅',
  'human nature': '🧠',
  'お土産':        '🎁',
  '挨拶':          '👋',
  '試着':          '👗',
  '写真':          '📷',
  '道教え':        '🗺️',
  '道迷い':        '🧭',
  '6歳以上':       '🔢',
  '6歳以下':       '👶',
};

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
  const [isPremium, setIsPremium] = useState(false);

  // セッション確認 & isAdmin / isPremium 取得
  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsLoggedIn(false);
      setIsAdmin(false);
      setIsPremium(false);
      setAuthReady(true);
      return;
    }
    setIsLoggedIn(true);
    const { data } = await supabase
      .from('profiles')
      .select('is_admin, is_premium')
      .eq('id', session.user.id)
      .single();
    setIsAdmin(data?.is_admin === true);
    setIsPremium(data?.is_premium === true);
    setAuthReady(true);
  };

  const handlePurchase = async () => {
    try {
      await purchasePremium();
    } catch (e: any) {
      Alert.alert('購入エラー', e?.message ?? '購入に失敗しました');
    }
  };

  const handleRestore = async () => {
    try {
      const restored = await restorePremium();
      if (restored) {
        setIsPremium(true);
        const rows = await fetchAllWords(true);
        setAllWords(rows);
        Alert.alert('復元完了', 'プレミアムプランを復元しました');
      } else {
        Alert.alert('復元できません', '購入履歴が見つかりませんでした');
      }
    } catch (e: any) {
      Alert.alert('エラー', e?.message ?? '復元に失敗しました');
    }
  };

  // DB初期化 & 認証確認
  useEffect(() => {
    setupIAP().catch(() => {});

    (async () => {
      await initDB();
      const rows = await fetchAllWords(isPremium);
      setAllWords(rows);
      setDbReady(true);
    })();
    checkAuth();

    const cleanupPurchase = setupPurchaseListeners(
      async (purchase) => {
        await activatePremium(purchase);
        setIsPremium(true);
        const rows = await fetchAllWords(true);
        setAllWords(rows);
        Alert.alert('購入完了', 'プレミアムプランへようこそ！');
      },
      (error) => {
        if ((error.code as string) !== 'E_USER_CANCELLED') {
          Alert.alert('購入エラー', error.message);
        }
      },
    );

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
    return () => {
      subscription.unsubscribe();
      cleanupPurchase();
    };
  }, []);

  useEffect(() => {
    if (screen === 'home') {
      fetchAllWords(isPremium).then(rows => setAllWords(rows)).catch(() => {});
    }
  }, [screen]);

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

    try {
      const rawPath = currentWordRef.current.audio_path;

      const localPath = await downloadAudioToLocal(rawPath);

      if (!samplePressActiveRef.current) {
        setIsPlayingSample(false);
        return;
      }

      let durationMs = 3000;
      try {
        const secs = await getAudioDuration(localPath);
        if (secs > 0) durationMs = Math.ceil(secs * 1000);
      } catch {}

      const startLoop = () => {
        if (!samplePressActiveRef.current) {
          setIsPlayingSample(false);
          return;
        }
        audioPlayer.startPlayer(localPath);
        loopTimerRef.current = setTimeout(startLoop, durationMs + 300);
      };

      startLoop();
    } catch {
      samplePressActiveRef.current = false;
      setIsPlayingSample(false);
    }
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

  const startGame = (categories?: string[]) => {
    if (isRecordingRef.current) {
      Voice.stop().catch(() => {});
    }
    isRecordingRef.current = false;
    isProcessingRef.current = false;
    isManualStopRef.current = false;
    latestSpokenRef.current = '';
    const filtered = categories && categories.length > 0
      ? allWords.filter(w => w.category !== null && categories.includes(w.category))
      : allWords;
    if (filtered.length === 0) {
      Alert.alert('単語がありません', 'このカテゴリにはまだ単語が登録されていません。');
      return;
    }
    const words = shuffleArray(filtered).slice(0, Math.min(10, filtered.length));
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
      onPurchase={handlePurchase}
      onRestore={handleRestore}
      wordCount={allWords.length}
      dbReady={dbReady}
      isAdmin={isAdmin}
      isPremium={isPremium}
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
  onPurchase,
  onRestore,
  wordCount,
  dbReady,
  isAdmin,
  isPremium,
}: {
  onStartBattle: (categories?: string[]) => void;
  onStartAI: () => void;
  onStartFlash: () => void;
  onAdmin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
  onPurchase: () => void;
  onRestore: () => void;
  wordCount: number;
  dbReady: boolean;
  isAdmin: boolean;
  isPremium: boolean;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = React.useState(false);
  const slideAnim = React.useRef(new Animated.Value(240)).current;

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const openMenu = () => {
    setMenuOpen(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const closeMenu = (cb?: () => void) => {
    Animated.timing(slideAnim, { toValue: 240, duration: 200, useNativeDriver: true }).start(() => {
      setMenuOpen(false);
      cb?.();
    });
  };

  return (
    <SafeAreaView style={styles.homeScreen}>
      <View style={styles.homeHeader}>
        <View style={styles.homeTitleArea}>
          <View style={styles.homeTitle}>
            <Image style={styles.homeLogo} source={require('./assets/icon_1024.png')} />
            <Text style={styles.homeTitleText}>英単語対戦</Text>
          </View>
          <Text style={styles.homeSubtitle}>モードを選んでスタート</Text>
        </View>
        <TouchableOpacity style={styles.hamburgerButton} onPress={openMenu}>
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <>
          <TouchableOpacity style={styles.menuOverlay} onPress={() => closeMenu()} activeOpacity={1} />
          <Animated.View style={[styles.sideMenu, { transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.sideMenuHeader}>
              <TouchableOpacity onPress={() => closeMenu()} style={styles.sideMenuClose}>
                <Text style={styles.sideMenuCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            {isAdmin && (
              <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(onAdmin)}>
                <Text style={styles.menuItemText}>⚙️ 管理</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.menuItem} onPress={() => closeMenu(onLogout)}>
              <Text style={styles.menuItemText}>ログアウト</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={() => closeMenu(onDeleteAccount)}>
              <Text style={styles.menuItemTextDanger}>アカウント削除</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}

      <ScrollView style={styles.modeList} contentContainerStyle={styles.modeListContent} showsVerticalScrollIndicator={false}>
        <View style={styles.modeSection}>
          {/* 2人対戦モード */}
          <TouchableOpacity
            style={[styles.modeCard, (!dbReady || wordCount === 0) && styles.modeCardDisabled]}
            onPress={() => onStartBattle(undefined)}
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
          {/* カテゴリ選択して対戦 */}
          <View style={styles.categorySelectCard}>
            <Text style={styles.categorySelectTitle}>カテゴリを選んで対戦</Text>

            {/* プルダウントリガー */}
            <TouchableOpacity
              style={styles.categoryDropdownBtn}
              onPress={() => setShowCategoryPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.categoryDropdownBtnText}>
                {selectedCategories.length === 0
                  ? 'カテゴリを選択　▼'
                  : `${selectedCategories.map(c => CATEGORY_EMOJI[c] + ' ' + c).join('、')}　▼`}
              </Text>
            </TouchableOpacity>

            {/* 選択後スタートボタン */}
            <TouchableOpacity
              style={[styles.categoryStartBtn, (selectedCategories.length === 0 || !dbReady) && styles.categoryStartBtnDisabled]}
              disabled={selectedCategories.length === 0 || !dbReady}
              onPress={() => onStartBattle(selectedCategories)}
              activeOpacity={0.85}
            >
              <Text style={styles.categoryStartBtnText}>
                {selectedCategories.length === 0 ? 'カテゴリを選んでください' : `${selectedCategories.length}件 ▶ 対戦スタート`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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

        {/* カテゴリ選択モーダル */}
        <Modal visible={showCategoryPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowCategoryPicker(false)} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>カテゴリを選択（複数可）</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)} style={styles.pickerDone}>
                <Text style={styles.pickerDoneText}>完了</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORIES.map(cat => {
                const selected = selectedCategories.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={styles.pickerRow}
                    onPress={() => toggleCategory(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerRowEmoji}>{CATEGORY_EMOJI[cat] ?? '📂'}</Text>
                    <Text style={[styles.pickerRowText, selected && styles.pickerRowTextOn]}>{cat}</Text>
                    <Text style={styles.pickerRowCheck}>{selected ? '☑' : '☐'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>

      </ScrollView>

      {/* プレミアムバナー（下固定） */}
      {isPremium ? (
        <View style={styles.premiumBanner}>
          <Text style={styles.premiumBannerText}>⭐ プレミアム会員</Text>
        </View>
      ) : (
        <View style={styles.premiumCard}>
          <View style={styles.premiumCardLeft}>
            <Text style={styles.premiumCardTitle}>⭐ プレミアムプラン</Text>
            <Text style={styles.premiumCardDesc}>プレミアム単語もプレイできる</Text>
          </View>
          <View style={styles.premiumCardButtons}>
            <TouchableOpacity style={styles.purchaseButton} onPress={onPurchase}>
              <Text style={styles.purchaseButtonText}>購入</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.restoreButton} onPress={onRestore}>
              <Text style={styles.restoreButtonText}>復元</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFBF0',
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
    backgroundColor: '#ffffff',
    borderRadius: 10,
  },
  quitButtonText: {
    color: '#D75F1B',
    fontSize: 13,
    fontWeight: '700',
  },
  turnText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: '#D75F1B',
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
    backgroundColor: 'rgba(215,95,27,0.08)',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 16,
    alignItems: 'center',
    minWidth: 220,
  },
  liveTextLabel: {
    fontSize: 10,
    color: '#D75F1B',
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 1,
  },
  liveText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#D75F1B',
    textAlign: 'center',
  },
  sampleButton: {
    alignSelf: 'center',
    backgroundColor: 'rgba(215,95,27,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginBottom: 12,
  },
  sampleButtonPlaying: {
    backgroundColor: '#D75F1B',
  },
  sampleButtonText: {
    color: '#D75F1B',
    fontSize: 14,
    fontWeight: '700',
  },
  homeScreen: {
    flex: 1,
    backgroundColor: '#FFFBF0',
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
  homeTitleArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  homeTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: '#D75F1B',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  homeTitleText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#D75F1B',
  },
  homeLogo: {
    width: 48,
    height: 48,
    marginBottom: 8,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#D75F1B',
  },
  homeSubtitle: {
    fontSize: 13,
    color: '#9A8A7A',
    marginTop: 2,
    marginBottom: 0,
    fontWeight: '600',
  },
  ruleBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  ruleItem: {
    fontSize: 15,
    color: '#3A2A1A',
  },
  wordCountText: {
    color: '#6A5A4A',
    fontSize: 13,
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: '#D75F1B',
    paddingVertical: 16,
    paddingHorizontal: 72,
    borderRadius: 32,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  adminHint: {
    marginTop: 24,
    padding: 8,
  },
  adminHintText: {
    color: '#C0B0A0',
    fontSize: 13,
  },
  logoutButton: {
    marginTop: 12,
    padding: 8,
  },
  logoutButtonText: {
    color: '#9A8A7A',
    fontSize: 13,
    fontWeight: '600',
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
  },
  modeListContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  modeSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    backgroundColor: '#FFF0D9',
    borderRadius: 12,
  },
  modeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D75F1B',
    padding: 20,
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
    fontWeight: '900',
    color: '#D75F1B',
  },
  modeDesc: {
    fontSize: 13,
    color: '#6A5A4A',
    lineHeight: 18,
    fontWeight: '500',
  },
  modeWordCount: {
    fontSize: 12,
    color: '#D75F1B',
    marginTop: 4,
    fontWeight: '700',
  },
  modeArrow: {
    fontSize: 28,
    color: '#D75F1B',
    fontWeight: '900',
  },
  modeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#D75F1B',
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
    color: '#9A8A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  premiumBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
  },
  premiumBannerText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  premiumCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#FFF0D9',
    borderRadius: 9,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#76432D',
  },
  premiumCardLeft: {
    flex: 1,
    gap: 4,
  },
  premiumCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#E8B526',
  },
  premiumCardDesc: {
    fontSize: 12,
    color: '#6A5A4A',
    fontWeight: '500',
  },
  premiumCardButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  purchaseButton: {
    backgroundColor: '#E8B526',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  purchaseButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 13,
  },
  restoreButton: {
    backgroundColor: 'rgba(232,181,38,0.12)',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#76432D',
  },
  restoreButtonText: {
    color: '#E8B526',
    fontWeight: '800',
    fontSize: 13,
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
  },
  hamburgerButton: {
    padding: 8,
    marginTop: 16,
  },
  hamburgerIcon: {
    fontSize: 24,
    color: '#D75F1B',
    fontWeight: '900',
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 240,
    backgroundColor: '#ffffff',
    zIndex: 10,
    paddingTop: 16,
  },
  sideMenuHeader: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 8,
  },
  sideMenuClose: {
    padding: 8,
  },
  sideMenuCloseText: {
    fontSize: 18,
    color: '#9A8A7A',
    fontWeight: '700',
  },
  menuItem: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  menuItemText: {
    alignItems: 'center',
    fontSize: 14,
    color: '#3A2A1A',
    fontWeight: '600',
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  menuItemTextDanger: {
    fontSize: 14,
    color: '#D75F1B',
    fontWeight: '600',
  },
  categorySection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  categorySectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9A8A7A',
    marginBottom: 8,
  },
  categoryScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  homeCategoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF3EA',
    borderWidth: 1.5,
    borderColor: '#F0D0B8',
  },
  homeCategoryChipSelected: {
    backgroundColor: '#D75F1B',
    borderColor: '#D75F1B',
  },
  homeCategoryChipText: {
    fontSize: 13,
    color: '#D75F1B',
    fontWeight: '700',
  },
  homeCategoryChipTextSelected: {
    color: '#ffffff',
  },
  categorySelectCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#F0D0B8',
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  categorySelectTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3A2A1A',
  },
  categorySelectHint: {
    fontSize: 12,
    color: '#9A8A7A',
    marginBottom: 4,
  },
  categoryChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFF3EA',
    borderWidth: 1.5,
    borderColor: '#F0D0B8',
  },
  categoryChipOn: {
    backgroundColor: '#D75F1B',
    borderColor: '#D75F1B',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#D75F1B',
    fontWeight: '700',
  },
  categoryChipTextOn: {
    color: '#ffffff',
  },
  categoryStartBtn: {
    backgroundColor: '#D75F1B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  categoryStartBtnDisabled: {
    backgroundColor: '#e2e8f0',
  },
  categoryStartBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  categoryDropdownBtn: {
    backgroundColor: '#FFF3EA',
    borderWidth: 1.5,
    borderColor: '#F0D0B8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  categoryDropdownBtnText: {
    fontSize: 14,
    color: '#D75F1B',
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0D0B8',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3A2A1A',
  },
  pickerDone: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#D75F1B',
    borderRadius: 8,
  },
  pickerDoneText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#FFF3EA',
    gap: 12,
  },
  pickerRowEmoji: {
    fontSize: 20,
  },
  pickerRowText: {
    flex: 1,
    fontSize: 15,
    color: '#3A2A1A',
    fontWeight: '600',
  },
  pickerRowTextOn: {
    color: '#D75F1B',
  },
  pickerRowCheck: {
    fontSize: 20,
    color: '#D75F1B',
  },
});
