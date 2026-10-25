import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from './Icon';

type Props = {
  player1Score: number;
  player2Score: number;
  onRestart: () => void;
};

// このページは #25935F 単色テーマ
export function GameOver({ player1Score, player2Score, onRestart }: Props) {
  const winner =
    player1Score > player2Score ? 'プレイヤー 1' :
    player2Score > player1Score ? 'プレイヤー 2' : null;

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>ゲーム終了！</Text>

        {winner ? (
          <>
            <View style={styles.resultIcon}>
              <Icon name="win" size={56} color="#25935F" accessibilityLabel="勝利" />
            </View>
            <Text style={styles.winner}>{winner}</Text>
            <Text style={styles.winnerSub}>の勝利！</Text>
          </>
        ) : (
          <>
            <View style={styles.resultIcon}>
              <Icon name="draw" size={56} color="#25935F" accessibilityLabel="引き分け" />
            </View>
            <Text style={styles.winner}>引き分け</Text>
            <Text style={styles.winnerSub}>いい勝負！</Text>
          </>
        )}

        <View style={styles.scoreBox}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>プレイヤー 1</Text>
            <Text style={[styles.scoreNum, player1Score > player2Score && styles.winScore]}>
              {player1Score}<Text style={styles.scoreUnit}>点</Text>
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>プレイヤー 2</Text>
            <Text style={[styles.scoreNum, player2Score > player1Score && styles.winScore]}>
              {player2Score}<Text style={styles.scoreUnit}>点</Text>
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={onRestart}>
          <View style={styles.buttonInner}>
            <Text style={styles.buttonText}>もう一度プレイ</Text>
            <Icon name="replay" size="md" color="#ffffff" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F0FAF5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#76432D',
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#25935F',
    marginBottom: 16,
    letterSpacing: 1,
  },
  resultIcon: {
    marginBottom: 8,
  },
  winner: {
    fontSize: 32,
    fontWeight: '900',
    color: '#25935F',
  },
  winnerSub: {
    fontSize: 18,
    color: '#9A8A7A',
    marginBottom: 24,
    fontWeight: '600',
  },
  scoreBox: {
    width: '100%',
    backgroundColor: 'rgba(37,147,95,0.08)',
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 28,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  divider: {
    height: 1.5,
    backgroundColor: 'rgba(37,147,95,0.2)',
  },
  scoreLabel: {
    fontSize: 15,
    color: '#6A5A4A',
    fontWeight: '600',
  },
  scoreNum: {
    fontSize: 26,
    fontWeight: '900',
    color: '#C0B0A0',
  },
  scoreUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  winScore: {
    color: '#25935F',
  },
  button: {
    width: '100%',
    backgroundColor: '#25935F',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
