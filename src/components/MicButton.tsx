import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function MicButton({ isRecording, onPress, disabled }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isRecording, pulse]);

  return (
    <View style={styles.wrapper}>
      {isRecording && (
        <Animated.View
          style={[styles.ripple, { transform: [{ scale: pulse }] }]}
        />
      )}
      <TouchableOpacity
        style={[styles.button, isRecording && styles.recording, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>🎤</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>
        {isRecording ? '録音中... もう一度押して停止' : '押して発音'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  ripple: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#06b6d4',
    opacity: 0.3,
  },
  button: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#06b6d4',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recording: {
    backgroundColor: '#ef4444',
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {
    fontSize: 28,
  },
  hint: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
});
