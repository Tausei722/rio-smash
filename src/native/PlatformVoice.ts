import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

export type SpeechResultsEvent = { value?: string[] };
export type SpeechErrorEvent = { error?: { message?: string } };

interface VoiceInterface {
  onSpeechResults: ((e: SpeechResultsEvent) => void) | null;
  onSpeechPartialResults: ((e: SpeechResultsEvent) => void) | null;
  onSpeechEnd: (() => void) | null;
  onSpeechError: ((e: SpeechErrorEvent) => void) | null;
  start: (locale: string) => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void>;
  destroy: () => Promise<void>;
  removeAllListeners: () => void;
}

const createAndroidVoice = (): VoiceInterface => {
  const { RNVoice } = NativeModules;

  const instance: VoiceInterface = {
    onSpeechResults: null,
    onSpeechPartialResults: null,
    onSpeechEnd: null,
    onSpeechError: null,
    start: (locale: string) => RNVoice.start(locale),
    stop: () => RNVoice.stop(),
    cancel: () => RNVoice.cancel(),
    destroy: () => RNVoice.destroy(),
    removeAllListeners: () => {
      instance.onSpeechResults = null;
      instance.onSpeechPartialResults = null;
      instance.onSpeechEnd = null;
      instance.onSpeechError = null;
    },
  };

  if (RNVoice) {
    const emitter = new NativeEventEmitter(RNVoice);
    emitter.addListener('RNVoice.onSpeechResults', (text: string) => {
      instance.onSpeechResults?.({ value: [text] });
    });
    emitter.addListener('RNVoice.onSpeechPartialResults', (text: string) => {
      instance.onSpeechPartialResults?.({ value: [text] });
    });
    emitter.addListener('RNVoice.onSpeechEnd', () => {
      instance.onSpeechEnd?.();
    });
    emitter.addListener('RNVoice.onSpeechError', (error: string) => {
      instance.onSpeechError?.({ error: { message: error } });
    });
  }

  return instance;
};

const createIOSVoice = (): VoiceInterface => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-voice/voice').default as VoiceInterface;
};

export const PlatformVoice: VoiceInterface =
  Platform.OS === 'android' ? createAndroidVoice() : createIOSVoice();
