import { supabase } from './supabase';
import { WORDS } from '../data/words';
import RNFS from 'react-native-fs';
import { decode } from 'base64-arraybuffer';

export const CATEGORIES = ['yesterday', 'human nature', 'お土産', '挨拶', '試着', '写真', '道教え', '道迷い', '6歳以上', '6歳以下', 'monkey magic', 'ラップ', '放送禁止'] as const;

// カテゴリ一覧を Supabase から取得（なければ初期値）
export async function fetchCategoryList(): Promise<string[]> {
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'categories')
    .single();
  if (!data) return [...CATEGORIES];
  return (data.value as string[]) ?? [...CATEGORIES];
}

// カテゴリ一覧を Supabase に保存
export async function saveCategoryList(categories: string[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'categories', value: categories });
  if (error) throw error;
}

// カテゴリ名変更（全単語を一括更新）
export async function renameCategory(oldName: string, newName: string): Promise<void> {
  if (oldName === newName) return;
  const { error } = await supabase
    .from('words')
    .update({ category: newName })
    .eq('category', oldName);
  if (error) throw error;
}

// 有料カテゴリ設定を Supabase から取得
export async function fetchPremiumCategories(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'premium_categories')
    .single();
  if (error || !data) return new Set();
  return new Set(data.value as string[]);
}

// 有料カテゴリ設定を Supabase に保存（管理者のみ）
export async function savePremiumCategories(categories: string[]): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'premium_categories', value: categories });
  if (error) throw error;
}
export type Category = typeof CATEGORIES[number];

export type WordRow = {
  id: number;
  katakana: string;
  english: string;
  japanese: string | null;
  detail: string | null;
  audio_path: string | null;
  is_premium: boolean;
  category: string | null;
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

// 全単語取得（isPremium=trueならプレミアム含む、category指定時はそのカテゴリのみ）
export async function fetchAllWords(isPremium: boolean = false, category?: string): Promise<WordRow[]> {
  let query = supabase.from('words').select('*').order('id', { ascending: false });
  if (!isPremium) {
    query = query.eq('is_premium', false);
  }
  if (category) {
    query = query.eq('category', category);
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
  category?: string,
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .insert({ katakana, english, japanese: japanese ?? null, detail: detail ?? null, audio_path: audioPath ?? null, is_premium: isPremium ?? false, category: category ?? null });
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
  category?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('words')
    .update({ katakana, english, japanese: japanese ?? null, detail: detail ?? null, audio_path: audioPath ?? null, is_premium: isPremium ?? false, category: category ?? null })
    .eq('id', id);
  if (error) throw error;
}

// 単語削除
export async function deleteWord(id: number): Promise<void> {
  const { error } = await supabase.from('words').delete().eq('id', id);
  if (error) throw error;
}

// Supabase StorageのURLから署名付きURL（1時間有効）を取得
export async function getSignedAudioUrl(audioPath: string): Promise<string> {
  if (!audioPath.startsWith('http')) return audioPath;
  const fileName = audioPath.split('/').pop()!;
  const { data, error } = await supabase.storage
    .from('audio')
    .createSignedUrl(fileName, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// 音声URLのローカルキャッシュ（同じURLを何度もダウンロードしない）
const audioDownloadCache = new Map<string, string>();

// 音声URLをローカルファイルにダウンロード（署名付きURL→直接URLの順で試みる）
export async function downloadAudioToLocal(audioPath: string): Promise<string> {
  if (!audioPath.startsWith('http')) return audioPath;

  const cached = audioDownloadCache.get(audioPath);
  if (cached && await RNFS.exists(cached)) {
    return cached;
  }
  audioDownloadCache.delete(audioPath);

  const dest = `${RNFS.DocumentDirectoryPath}/audio_cache_${Date.now()}.m4a`;

  // まず署名付きURLで試みる（プライベートバケット対応）
  try {
    const signedUrl = await getSignedAudioUrl(audioPath);
    const result = await RNFS.downloadFile({ fromUrl: signedUrl, toFile: dest }).promise;
    if (result.statusCode === 200 && result.bytesWritten > 0) {
      audioDownloadCache.set(audioPath, dest);
      return dest;
    }
  } catch {}

  // フォールバック：直接URLでダウンロード（パブリックバケット対応）
  const result = await RNFS.downloadFile({ fromUrl: audioPath, toFile: dest }).promise;
  if (result.statusCode !== 200 || result.bytesWritten === 0) {
    throw new Error('音声ファイルのダウンロードに失敗しました');
  }
  audioDownloadCache.set(audioPath, dest);
  return dest;
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
