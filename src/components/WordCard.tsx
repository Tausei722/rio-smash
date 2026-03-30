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
      <Text style={styles.label}>WORD CARDS</Text>
      <Text style={styles.katakana}>{katakana}</Text>
      {showEnglish ? (
        <>
          <Text style={styles.english}>{english}</Text>
          {japanese ? <Text style={styles.japanese}>{japanese}</Text> : null}
        </>
      ) : (
        <Text style={styles.englishHidden}>？？？</Text>
      )}
      <Text style={styles.counter}>{questionIndex + 1} / {total}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#06b6d4',
    borderRadius: 24,
    borderWidth: 4,
    borderColor: '#0e7490',
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  label: {
    color: '#a5f3fc',
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 16,
  },
  katakana: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  english: {
    color: '#cffafe',
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 1,
  },
  englishHidden: {
    color: '#a5f3fc',
    fontSize: 22,
    fontWeight: '500',
    marginBottom: 20,
    letterSpacing: 4,
  },
  japanese: {
    color: '#a5f3fc',
    fontSize: 16,
    marginTop: -12,
    marginBottom: 20,
    textAlign: 'center',
  },
  counter: {
    color: '#a5f3fc',
    fontSize: 13,
  },
});
