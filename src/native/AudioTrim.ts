import { NativeModules } from 'react-native';

const { RNAudioTrim } = NativeModules;

function cleanPath(path: string): string {
  // file:// プレフィックスはネイティブ側で処理するためそのまま渡す
  return path;
}

export function getAudioDuration(inputPath: string): Promise<number> {
  return RNAudioTrim.getDuration(cleanPath(inputPath));
}

export function getWaveformData(inputPath: string, numSamples: number): Promise<number[]> {
  return RNAudioTrim.getWaveformData(cleanPath(inputPath), numSamples);
}

export function playPreview(inputPath: string, startTime: number, endTime: number): Promise<void> {
  return RNAudioTrim.playPreview(cleanPath(inputPath), startTime, endTime);
}

export function stopPreview(): Promise<void> {
  return RNAudioTrim.stopPreview();
}

export function trimAudio(
  inputPath: string,
  startTime: number,
  endTime: number,
): Promise<string> {
  return RNAudioTrim.trim(cleanPath(inputPath), startTime, endTime);
}
