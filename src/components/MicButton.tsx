import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
          Animated.timing(pulse, { toValue: 1.35, duration: 500, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [isRecording, pulse]);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.button, isRecording && styles.recording, disabled && styles.disabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {isRecording && (
          <Animated.View style={[styles.ripple, { transform: [{ scale: pulse }] }]} />
        )}
        <Text style={styles.icon}>🎤</Text>
      </TouchableOpacity>
      <Text style={[styles.hint, isRecording && styles.hintRecording]}>
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
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#D75F1B',
    opacity: 0.25,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#D75F1B',
  },
  recording: {
    opacity: 0.65,
  },
  disabled: {
    opacity: 0.35,
  },
  icon: {
    zIndex: 10,
    fontSize: 30,
  },
  hint: {
    marginTop: 12,
    color: '#9A8A7A',
    fontSize: 13,
    fontWeight: '600',
  },
  hintRecording: {
    color: '#D75F1B',
  },
});
