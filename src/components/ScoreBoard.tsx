import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  player1Score: number;
  player2Score: number;
  currentPlayer: 1 | 2;
};

export function ScoreBoard({ player1Score, player2Score, currentPlayer }: Props) {
  return (
    <View style={styles.row}>
      <PlayerCard
        label="プレイヤー 1"
        score={player1Score}
        active={currentPlayer === 1}
      />
      <View style={styles.vs}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <PlayerCard
        label="プレイヤー 2"
        score={player2Score}
        active={currentPlayer === 2}
      />
    </View>
  );
}

function PlayerCard({
  label,
  score,
  active,
}: {
  label: string;
  score: number;
  active: boolean;
}) {
  return (
    <View style={[styles.card, active && styles.activeCard]}>
      <Text style={styles.playerLabel}>{label}</Text>
      <Text style={[styles.score, active && styles.activeScore]}>{score}</Text>
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#e2e8f0',
    padding: 16,
    alignItems: 'center',
    opacity: 0.6,
  },
  activeCard: {
    borderColor: '#06b6d4',
    opacity: 1,
    transform: [{ scale: 1.05 }],
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  playerLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 4,
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  activeScore: {
    color: '#06b6d4',
  },
  turnBadge: {
    fontSize: 10,
    color: '#06b6d4',
    fontWeight: '600',
    marginTop: 4,
  },
  vs: {
    paddingHorizontal: 12,
  },
  vsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
});
