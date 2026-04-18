import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  katakana: string;
  english: string;
  japanese?: string | null;
  questionIndex: number;
  total: number;
  showEnglish?: boolean;
};

export function WordCard({ katakana, english, japanese, questionIndex, total, showEnglish = false }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>WORD CARD</Text>
        </View>
        <Text style={styles.counter}>{questionIndex + 1} / {total}</Text>
      </View>

      <Text style={styles.katakana}>{katakana}</Text>

      {showEnglish ? (
        <View style={styles.answerBox}>
          <Text style={styles.english}>{english}</Text>
          {japanese ? <Text style={styles.japanese}>{japanese}</Text> : null}
        </View>
      ) : (
        <View style={styles.hiddenBox}>
          <Text style={styles.hiddenText}>？？？</Text>
          <Text style={styles.hiddenHint}>発音してみよう！</Text>
        </View>
      )}
    </View>
  );
}

// このカードは #D75F1B 単色テーマ
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#D75F1B',
    borderRadius: 28,
    paddingVertical: 36,
    paddingHorizontal: 28,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  counter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  katakana: {
    color: '#ffffff',
    fontSize: 44,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 20,
  },
  answerBox: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  english: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  japanese: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    marginTop: 6,
    textAlign: 'center',
  },
  hiddenBox: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  hiddenText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 6,
  },
  hiddenHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 6,
  },
});
