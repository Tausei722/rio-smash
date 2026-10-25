import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  children: React.ReactNode;
  // 「戻る」を押したときに呼ぶ（ホームへ戻すなど）。省略時はボタンを出さず再描画のみ。
  onReset?: () => void;
};

type State = { error: Error | null };

// どこか1画面で throw してもアプリ全体を落とさず、復帰用の画面を出す。
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // 端末ログに残す（Xcode / logcat / クラッシュ解析で拾える）
    console.error('[ErrorBoundary]', error?.message, error?.stack, info?.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>問題が発生しました</Text>
          <Text style={styles.body}>
            この画面を表示できませんでした。{'\n'}下のボタンでホームに戻れます。
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>ホームに戻る</Text>
          </TouchableOpacity>
          {__DEV__ && (
            <Text style={styles.debug}>{String(this.state.error?.message)}</Text>
          )}
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFBF0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#D75F1B',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: '#6A5A4A',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  button: {
    backgroundColor: '#D75F1B',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 24,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  debug: {
    marginTop: 24,
    fontSize: 11,
    color: '#9A8A7A',
    textAlign: 'center',
  },
});
