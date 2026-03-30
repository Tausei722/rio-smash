import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { getAudioDuration, getWaveformData, playPreview, stopPreview, trimAudio } from '../native/AudioTrim';

const NUM_BARS = 80;

type Props = {
  audioPath: string;
  onTrimmed: (newPath: string) => void;
  onCancel: () => void;
};

export function AudioTrimmer({ audioPath, onTrimmed, onCancel }: Props) {
  const [duration, setDuration] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [startRatio, setStartRatio] = useState(0);
  const [endRatio, setEndRatio] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTrimming, setIsTrimming] = useState(false);
  const [loading, setLoading] = useState(true);

  const startRatioRef = useRef(0);
  const endRatioRef = useRef(1);
  const containerW = useRef(0);
  const containerPageX = useRef(0);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    Promise.all([
      getAudioDuration(audioPath),
      getWaveformData(audioPath, NUM_BARS),
    ])
      .then(([secs, bars]) => {
        setDuration(secs);
        setWaveform(bars);
        setLoading(false);
      })
      .catch(e => {
        Alert.alert('エラー', `${e?.message ?? '読み込み失敗'}\n\npath: ${audioPath}`);
        onCancel();
      });
  }, [audioPath]);

  const measureContainer = () => {
    containerRef.current?.measure((_, __, width, ___, pageX) => {
      containerW.current = width;
      containerPageX.current = pageX;
    });
  };

  const leftPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: measureContainer,
      onPanResponderMove: (_, gs) => {
        const w = containerW.current;
        if (!w) return;
        const ratio = Math.max(
          0,
          Math.min((gs.moveX - containerPageX.current) / w, endRatioRef.current - 0.02),
        );
        startRatioRef.current = ratio;
        setStartRatio(ratio);
      },
    }),
  ).current;

  const rightPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: measureContainer,
      onPanResponderMove: (_, gs) => {
        const w = containerW.current;
        if (!w) return;
        const ratio = Math.min(
          1,
          Math.max((gs.moveX - containerPageX.current) / w, startRatioRef.current + 0.02),
        );
        endRatioRef.current = ratio;
        setEndRatio(ratio);
      },
    }),
  ).current;

  const handlePreview = async () => {
    if (isPlaying) {
      await stopPreview();
      setIsPlaying(false);
      return;
    }
    try {
      setIsPlaying(true);
      await playPreview(audioPath, startRatioRef.current * duration, endRatioRef.current * duration);
      // 再生終了後に自動でOFF（タイマーで止まる）
      const playDuration = (endRatioRef.current - startRatioRef.current) * duration;
      setTimeout(() => setIsPlaying(false), playDuration * 1000);
    } catch (e: any) {
      setIsPlaying(false);
      Alert.alert('再生エラー', e?.message ?? '再生できませんでした');
    }
  };

  const handleTrim = async () => {
    setIsTrimming(true);
    try {
      const startSec = startRatioRef.current * duration;
      const endSec = endRatioRef.current * duration;
      const newPath = await trimAudio(audioPath, startSec, endSec);
      onTrimmed(newPath);
    } catch (e: any) {
      Alert.alert('トリムエラー', e?.message ?? '不明なエラー');
    } finally {
      setIsTrimming(false);
    }
  };

  const fmt = (ratio: number) => {
    const s = ratio * duration;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${String(sec).padStart(2, '0')}.${ms}`;
  };

  const selectedSec = (endRatio - startRatio) * duration;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✂️ 音声トリム</Text>

      {loading ? (
        <View style={styles.loadingArea}>
          <ActivityIndicator color="#06b6d4" size="large" />
          <Text style={styles.loadingText}>波形を解析中...</Text>
        </View>
      ) : (
        <>
          <View
            ref={containerRef}
            style={styles.waveformOuter}
            onLayout={measureContainer}
          >
            <View style={styles.waveformBars}>
              {waveform.map((amp, i) => {
                const ratio = i / NUM_BARS;
                const inRange = ratio >= startRatio && ratio < endRatio;
                const barH = Math.max(4, amp * 80);
                return (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      { height: barH },
                      inRange ? styles.barActive : styles.barInactive,
                    ]}
                  />
                );
              })}
            </View>

            <View
              style={[
                styles.selectionOverlay,
                {
                  left: `${startRatio * 100}%`,
                  right: `${(1 - endRatio) * 100}%`,
                },
              ]}
              pointerEvents="none"
            />

            <View
              style={[styles.handle, { left: `${startRatio * 100}%` }]}
              {...leftPan.panHandlers}
            >
              <View style={styles.handleLine} />
              <View style={styles.handleKnob}>
                <Text style={styles.handleArrow}>◀</Text>
              </View>
            </View>

            <View
              style={[styles.handle, { left: `${endRatio * 100}%` }]}
              {...rightPan.panHandlers}
            >
              <View style={styles.handleLine} />
              <View style={styles.handleKnob}>
                <Text style={styles.handleArrow}>▶</Text>
              </View>
            </View>
          </View>

          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{fmt(startRatio)}</Text>
            <Text style={styles.timeDuration}>選択：{selectedSec.toFixed(1)}秒</Text>
            <Text style={styles.timeText}>{fmt(endRatio)}</Text>
          </View>

          <TouchableOpacity style={styles.previewBtn} onPress={handlePreview}>
            <Text style={styles.previewBtnText}>
              {isPlaying ? '⏹ 停止' : '▶ 選択範囲を試聴'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.trimBtn, isTrimming && styles.btnDisabled]}
            onPress={handleTrim}
            disabled={isTrimming}
          >
            {isTrimming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.trimBtnText}>✂️ この範囲でトリム</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>キャンセル</Text>
      </TouchableOpacity>
    </View>
  );
}

const WAVEFORM_HEIGHT = 90;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0e7490',
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingArea: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
  },
  waveformOuter: {
    height: WAVEFORM_HEIGHT,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    overflow: 'visible',
    marginBottom: 8,
  },
  waveformBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: '#06b6d4',
  },
  barInactive: {
    backgroundColor: '#cbd5e1',
  },
  selectionOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(6,182,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.4)',
  },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    alignItems: 'center',
    transform: [{ translateX: -14 }],
  },
  handleLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#0e7490',
    borderRadius: 2,
  },
  handleKnob: {
    position: 'absolute',
    bottom: -18,
    width: 28,
    height: 22,
    backgroundColor: '#0e7490',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleArrow: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 12,
    color: '#64748b',
  },
  timeDuration: {
    fontSize: 13,
    color: '#0e7490',
    fontWeight: '600',
  },
  previewBtn: {
    backgroundColor: '#e0f2fe',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  previewBtnText: {
    color: '#0284c7',
    fontWeight: '600',
    fontSize: 15,
  },
  trimBtn: {
    backgroundColor: '#0e7490',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  trimBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 14,
  },
});
