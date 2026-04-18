import { supabase } from './supabase';
import { WORDS } from '../data/words';
import RNFS from 'react-native-fs';
import { decode } from 'base64-arraybuffer';

export type WordRow = {
  id: number;
  katakana: string;
  english: string;
  japanese: string | null;
  detail: string | null;
  audio_path: string | null;
  is_premium: boolean;
  created_at?: string;
};

// 初回起動時にサンプルデータを投入
export async function initDB(): Promise<void> {
  const { count } = await supabase
    .from('words')
    .select('*', { count: 'exact', head: true });

  if (count === 0) {
    await supabase.from('words').insert(
      WORDS.map(w => ({ katakana: w.katakana, english: w.english })),
    );
  }
}

// 全単語取得（isPremium=trueならプレミアム含む、falseならノーマルのみ）
export async function fetchAllWords(isPremium: boolean = false): Promise<WordRow[]> {
  let query = supabase.from('words').select('*').order('id', { ascending: false });
  if (!isPremium) {
    query = query.eq('is_premium', false);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// 単語追加
export async function insertWord(
  katakana: string,
  english: string,
  japanese?: string,
  detail?: string,
  audioPath?: string,
  isPremium?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .insert({ katakana, english, japanese: japanese ?? null, detail: detail ?? null, audio_path: audioPath ?? null, is_premium: isPremium ?? false });
  if (error) throw error;
}

// 単語更新
export async function updateWord(
  id: number,
  katakana: string,
  english: string,
  japanese?: string | null,
  detail?: string | null,
  audioPath?: string | null,
  isPremium?: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ katakana, english, japanese: japanese ?? null, detail: detail ?? null, audio_path: audioPath ?? null, is_premium: isPremium ?? false })
    .eq('id', id);
  if (error) throw error;
}

// 単語削除
export async function deleteWord(id: number): Promise<void> {
  const { error } = await supabase.from('words').delete().eq('id', id);
  if (error) throw error;
}

// 音声ファイルをSupabase Storageにアップロードしてpublic URLを返す
export async function uploadAudio(
  localPath: string,
  wordEnglish: string,
): Promise<string> {
  const safeName = wordEnglish.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
  const fileName = `${safeName}_${Date.now()}.m4a`;

  // React NativeはfetchでローカルファイルをBlobにできないのでRNFSで読む
  const base64 = await RNFS.readFile(localPath, 'base64');
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from('audio')
    .upload(fileName, arrayBuffer, { contentType: 'audio/m4a', upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('audio').getPublicUrl(fileName);
  return data.publicUrl;
}
