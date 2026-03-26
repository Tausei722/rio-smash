import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  player1Score: number;
  player2Score: number;
  onRestart: () => void;
};

export function GameOver({ player1Score, player2Score, onRestart }: Props) {
  const winner =
    player1Score > player2Score
      ? 'プレイヤー 1'
      : player2Score > player1Score
      ? 'プレイヤー 2'
      : null;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>ゲーム終了！</Text>

        {winner ? (
          <>
            <Text style={styles.trophy}>🏆</Text>
            <Text style={styles.winner}>{winner}</Text>
            <Text style={styles.winnerSub}>の勝利！</Text>
          </>
        ) : (
          <>
            <Text style={styles.trophy}>🤝</Text>
            <Text style={styles.winner}>引き分け</Text>
          </>
        )}

        <View style={styles.scoreBox}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>プレイヤー 1</Text>
            <Text style={[styles.scoreNum, player1Score > player2Score && styles.winScore]}>
              {player1Score}点
            </Text>
          </View>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>プレイヤー 2</Text>
            <Text style={[styles.scoreNum, player2Score > player1Score && styles.winScore]}>
              {player2Score}点
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={onRestart}>
          <Text style={styles.buttonText}>もう一度プレイ</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0e7490',
    marginBottom: 16,
  },
  trophy: {
    fontSize: 56,
    marginBottom: 12,
  },
  winner: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#06b6d4',
  },
  winnerSub: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 24,
  },
  scoreBox: {
    width: '100%',
    backgroundColor: '#ecfeff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 28,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 16,
    color: '#475569',
  },
  scoreNum: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  winScore: {
    color: '#06b6d4',
  },
  button: {
    width: '100%',
    backgroundColor: '#06b6d4',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
