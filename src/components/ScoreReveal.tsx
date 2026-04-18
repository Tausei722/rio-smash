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

// このカードは #E8B526 単色テーマ
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
        <View style={styles.playerBadge}>
          <Text style={styles.playerText}>プレイヤー {currentPlayer}</Text>
        </View>

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
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
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
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#76432D',
    padding: 28,
    marginHorizontal: 20,
    alignItems: 'center',
    width: '88%',
  },
  playerBadge: {
    backgroundColor: '#E8B526',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginBottom: 12,
  },
  playerText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  score: {
    fontSize: 84,
    fontWeight: '900',
    lineHeight: 92,
  },
  scoreUnit: {
    fontSize: 18,
    color: '#9A8A7A',
    marginBottom: 4,
    fontWeight: '600',
  },
  message: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 20,
  },
  divider: {
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(232,181,38,0.25)',
    marginBottom: 16,
    borderRadius: 1,
  },
  comparison: {
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  compRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(232,181,38,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  compLabel: {
    fontSize: 11,
    color: '#9A8A7A',
    fontWeight: '700',
    flexShrink: 0,
    paddingTop: 2,
  },
  compValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2A1A0A',
    flexShrink: 1,
    textAlign: 'right',
  },
  correct: {
    color: '#E8B526',
  },
  compJapanese: {
    fontSize: 11,
    color: '#9A8A7A',
    marginTop: 2,
    textAlign: 'right',
  },
  detailButton: {
    width: '100%',
    paddingVertical: 11,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(232,181,38,0.12)',
    borderWidth: 2,
    borderColor: '#76432D',
    marginBottom: 10,
  },
  detailButtonText: {
    color: '#E8B526',
    fontSize: 14,
    fontWeight: '700',
  },
  nextButton: {
    backgroundColor: '#E8B526',
    paddingVertical: 14,
    paddingHorizontal: 52,
    borderRadius: 32,
  },
  nextText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
  },
});
