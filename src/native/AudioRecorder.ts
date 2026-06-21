import { NativeModules } from 'react-native';

const { RNAudioRecorder } = NativeModules;

export const AudioRecorder = {
  startRecording: (path: string): Promise<void> =>
    RNAudioRecorder.startRecording(path),
  stopRecording: (): Promise<string> =>
    RNAudioRecorder.stopRecording(),
  startPlayback: (path: string): Promise<void> =>
    RNAudioRecorder.startPlayback(path),
  stopPlayback: (): Promise<void> =>
    RNAudioRecorder.stopPlayback(),
};
