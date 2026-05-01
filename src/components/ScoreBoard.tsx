import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  player1Score: number;
  player2Score: number;
  currentPlayer: 1 | 2;
};

// P1 → #D75F1B 単色 / VS → #E8B526 単色 / P2 → #25935F 単色
export function ScoreBoard({ player1Score, player2Score, currentPlayer }: Props) {
  return (
    <View style={styles.row}>
      <PlayerCard label="プレイヤー 1" score={player1Score} active={currentPlayer === 1} color="#D75F1B" />
      <View style={styles.vs}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <PlayerCard label="プレイヤー 2" score={player2Score} active={currentPlayer === 2} color="#25935F" />
    </View>
  );
}

function PlayerCard({ label, score, active, color }: { label: string; score: number; active: boolean; color: string }) {
  return (
    <View style={[styles.card, active && (color === '#D75F1B'
      ? { backgroundColor: color, borderWidth: 0, opacity: 1 }
      : { backgroundColor: color, borderColor: '#76432D', opacity: 1 }
    )]}>
      <Text style={[styles.playerLabel, active && styles.playerLabelActive]}>{label}</Text>
      <Text style={[styles.score, active && styles.scoreActive]}>{score}</Text>
      {active && <Text style={styles.turnBadge}>ターン中</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 24,
  },
  card: {
    flex: 1,
    backgroundColor: '#F0EAE0',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#76432D',
    padding: 16,
    alignItems: 'center',
    opacity: 0.45,
  },
  playerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9A8A7A',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  playerLabelActive: {
    color: 'rgba(255,255,255,0.85)',
  },
  score: {
    fontSize: 38,
    fontWeight: '900',
    color: '#C0B0A0',
  },
  scoreActive: {
    color: '#ffffff',
  },
  turnBadge: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    marginTop: 6,
  },
  vs: {
    paddingHorizontal: 12,
  },
  vsText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#D75F1B',
    letterSpacing: 2,
  },
});
