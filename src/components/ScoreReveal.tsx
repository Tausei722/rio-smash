import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { scoreColor, scoreMessage } from '../utils/scoring';
import { WordDetailModal } from './WordDetailModal';

type Props = {
  score: number;
  spokenText: string;
  expectedWord: string;
  japanese?: string | null;
  detail?: string | null;
  currentPlayer: 1 | 2;
  onNext: () => void;
};

export function ScoreReveal({ score, spokenText, expectedWord, japanese, detail, currentPlayer, onNext }: Props) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const color = scoreColor(score);
  const message = scoreMessage(score);

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
        <Text style={styles.playerText}>プレイヤー {currentPlayer}</Text>

        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.scoreUnit}>点</Text>
        <Text style={[styles.message, { color }]}>{message}</Text>

        <View style={styles.divider} />

        <View style={styles.comparison}>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>あなたの発音</Text>
            <Text style={styles.compValue}>
              {spokenText || '（認識できませんでした）'}
            </Text>
          </View>
          <View style={styles.compRow}>
            <Text style={styles.compLabel}>正解</Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.compValue, styles.correct]}>{expectedWord}</Text>
              {japanese ? <Text style={styles.compJapanese}>{japanese}</Text> : null}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.detailButton} onPress={() => setShowDetail(true)}>
          <Text style={styles.detailButtonText}>📖 使い方・文法を見る</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextButton} onPress={onNext}>
          <Text style={styles.nextText}>次へ →</Text>
        </TouchableOpacity>
      </Animated.View>

      <WordDetailModal
        visible={showDetail}
        english={expectedWord}
        japanese={japanese}
        detail={detail}
        onClose={() => setShowDetail(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    marginHorizontal: 24,
    alignItems: 'center',
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  playerText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  score: {
    fontSize: 80,
    fontWeight: 'bold',
    lineHeight: 90,
  },
  scoreUnit: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 4,
  },
  message: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  comparison: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  compLabel: {
    fontSize: 12,
    color: '#94a3b8',
    flexShrink: 0,
    paddingTop: 2,
  },
  compValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    flexShrink: 1,
    textAlign: 'right',
  },
  correct: {
    color: '#22c55e',
  },
  compJapanese: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  detailButton: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f0fdfe',
    borderWidth: 1.5,
    borderColor: '#a5f3fc',
    marginBottom: 10,
  },
  detailButtonText: {
    color: '#0e7490',
    fontSize: 14,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#06b6d4',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 32,
  },
  nextText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
