import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from '@react-native-voice/voice';

import { WORDS } from './src/data/words';
import { calcPronunciationScore } from './src/utils/scoring';
import { GameOver } from './src/components/GameOver';
import { MicButton } from './src/components/MicButton';
import { ScoreBoard } from './src/components/ScoreBoard';
import { ScoreReveal } from './src/components/ScoreReveal';
import { WordCard } from './src/components/WordCard';

type Screen = 'home' | 'game' | 'gameover';

// ゲームごとにシャッフルした問題リストを作る
function shuffleWords() {
  return [...WORDS].sort(() => Math.random() - 0.5).slice(0, 10);
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
  const [words] = useState(shuffleWords);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [player1Score, setPlayer1Score] = useState(0);
  const [player2Score, setPlayer2Score] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [reveal, setReveal] = useState<{
    score: number;
    spoken: string;
  } | null>(null);

  const currentWord = words[questionIndex];
  const isLastQuestion = questionIndex >= words.length - 1;

  // Voice イベント登録
  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const spoken = e.value?.[0] ?? '';
      handleRecognized(spoken);
    };
    Voice.onSpeechError = (_e: SpeechErrorEvent) => {
      setIsRecording(false);
      Alert.alert('エラー', '音声を認識できませんでした。もう一度試してください。');
    };
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionIndex, currentPlayer, player1Score, player2Score]);

  const handleRecognized = useCallback(
    (spoken: string) => {
      setIsRecording(false);
      const score = calcPronunciationScore(spoken, currentWord.english);
      setReveal({ score, spoken });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentWord],
  );

  const handleMicPress = async () => {
    if (isRecording) {
      try {
        await Voice.stop();
      } catch {
        setIsRecording(false);
      }
    } else {
      try {
        setIsRecording(true);
        await Voice.start('en-US');
      } catch {
        setIsRecording(false);
        Alert.alert('エラー', 'マイクを開始できませんでした。');
      }
    }
  };

  const handleNext = () => {
    if (!reveal) return;

    // スコア加算
    if (currentPlayer === 1) {
      setPlayer1Score(prev => prev + reveal.score);
    } else {
      setPlayer2Score(prev => prev + reveal.score);
    }

    setReveal(null);

    if (isLastQuestion) {
      setScreen('gameover');
    } else {
      setQuestionIndex(prev => prev + 1);
      setCurrentPlayer(prev => (prev === 1 ? 2 : 1));
    }
  };

  const handleRestart = () => {
    setQuestionIndex(0);
    setCurrentPlayer(1);
    setPlayer1Score(0);
    setPlayer2Score(0);
    setReveal(null);
    setIsRecording(false);
    setScreen('game');
  };

  if (screen === 'home') {
    return <HomeScreen onStart={() => setScreen('game')} />;
  }

  if (screen === 'gameover') {
    return (
      <GameOver
        player1Score={player1Score}
        player2Score={player2Score}
        onRestart={handleRestart}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.turnText}>
        プレイヤー {currentPlayer} のターン
      </Text>

      <ScoreBoard
        player1Score={player1Score}
        player2Score={player2Score}
        currentPlayer={currentPlayer}
      />

      <WordCard
        katakana={currentWord.katakana}
        english={currentWord.english}
        questionIndex={questionIndex}
        total={words.length}
      />

      <View style={styles.micArea}>
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
          currentPlayer={currentPlayer}
          onNext={handleNext}
        />
      )}
    </SafeAreaView>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <SafeAreaView style={styles.homeScreen}>
      <View style={styles.homeCenter}>
        <Text style={styles.homeEmoji}>🗣️</Text>
        <Text style={styles.homeTitle}>英単語対戦</Text>
        <Text style={styles.homeSubtitle}>
          カタカナ英語を正確に発音して{'\n'}2人で発音精度を競おう！
        </Text>
        <View style={styles.ruleBox}>
          <Text style={styles.ruleItem}>① カタカナ英語が表示される</Text>
          <Text style={styles.ruleItem}>② 🎤 ボタンを押して発音</Text>
          <Text style={styles.ruleItem}>③ 発音の正確さが点数に！</Text>
          <Text style={styles.ruleItem}>④ 合計点数で勝負！</Text>
        </View>
        <Text
          style={styles.startButton}
          onPress={onStart}
        >
          スタート
        </Text>
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
  // Home
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
    marginBottom: 12,
  },
  homeTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#0e7490',
    marginBottom: 8,
  },
  homeSubtitle: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  ruleBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    gap: 10,
    marginBottom: 40,
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
  startButton: {
    backgroundColor: '#06b6d4',
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    paddingVertical: 16,
    paddingHorizontal: 72,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
