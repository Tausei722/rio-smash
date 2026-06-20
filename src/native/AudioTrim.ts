import { NativeModules, Platform } from 'react-native';

const { RNAudioTrim } = NativeModules;

function cleanPath(path: string): string {
  return path;
}

export function getAudioDuration(inputPath: string): Promise<number> {
  if (Platform.OS !== 'ios') return Promise.resolve(0);
  return RNAudioTrim.getDuration(cleanPath(inputPath));
}

export function getWaveformData(inputPath: string, numSamples: number): Promise<number[]> {
  if (Platform.OS !== 'ios') return Promise.resolve([]);
  return RNAudioTrim.getWaveformData(cleanPath(inputPath), numSamples);
}

export function playPreview(inputPath: string, startTime: number, endTime: number): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return RNAudioTrim.playPreview(cleanPath(inputPath), startTime, endTime);
}

export function stopPreview(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  return RNAudioTrim.stopPreview();
}

export function trimAudio(
  inputPath: string,
  startTime: number,
  endTime: number,
): Promise<string> {
  if (Platform.OS !== 'ios') return Promise.reject(new Error('音声トリムはiOSのみ対応しています'));
  return RNAudioTrim.trim(cleanPath(inputPath), startTime, endTime);
}
