import type { WordRow, CategoryAccessMap } from '../db/database';

// カテゴリの表示ルール
// - category_access に割り当てがある = 特定ユーザー専用（親子三代英語ゲーム側に出す）
// - category_access に割り当てが無い = 共有カテゴリ（2人対戦のカテゴリ選択に出す）
// 仕様: docs/spec-category-access.md

/** category_access に1件以上の割り当てがある（＝共有カテゴリではない） */
export function isRestrictedCategory(
  category: string,
  access: CategoryAccessMap,
): boolean {
  const assigned = access[category];
  return !!assigned && assigned.length > 0;
}

/** このカテゴリが指定ユーザーに紐づいているか */
export function isCategoryLinkedToUser(
  category: string,
  access: CategoryAccessMap,
  userId: string | null,
): boolean {
  if (userId === null) {
    return false;
  }
  const assigned = access[category];
  return !!assigned && assigned.includes(userId);
}

/**
 * 親子三代英語ゲームに出すカテゴリ。
 * master リストのうち、現在のユーザーに紐づいているものだけ。
 * 空配列ならカード自体を出さない。
 */
export function oyakoCategoriesForUser(
  categories: string[],
  access: CategoryAccessMap,
  userId: string | null,
): string[] {
  return categories.filter(c => isCategoryLinkedToUser(c, access, userId));
}

/**
 * 2人対戦のカテゴリ選択に出すカテゴリ。
 * master リストのうち、誰にも紐づいていない共有カテゴリだけ。
 */
export function sharedCategories(
  categories: string[],
  access: CategoryAccessMap,
): string[] {
  return categories.filter(c => !isRestrictedCategory(c, access));
}

export type WordVisibilityOptions = {
  access: CategoryAccessMap;
  userId: string | null;
  isPremium: boolean;
};

/**
 * この単語をユーザーが閲覧できるか（プレミアム判定込み）。
 * - 自分に紐づいたカテゴリの単語は is_premium に関係なく閲覧可（決定A）
 * - それ以外は is_premium=true ならプレミアム会員のみ
 */
export function canUserSeeWord(
  word: WordRow,
  opts: WordVisibilityOptions,
): boolean {
  if (
    word.category !== null &&
    isCategoryLinkedToUser(word.category, opts.access, opts.userId)
  ) {
    return true;
  }
  if (word.is_premium && !opts.isPremium) {
    return false;
  }
  return true;
}

/**
 * カテゴリ指定なしの「2人対戦」で使う単語。
 * - 誰かに紐づいた専用カテゴリの単語は除外（決定C）
 * - 残りにプレミアム判定を適用
 */
export function wordsForOpenBattle(
  words: WordRow[],
  opts: WordVisibilityOptions,
): WordRow[] {
  return words.filter(w => {
    if (w.category !== null && isRestrictedCategory(w.category, opts.access)) {
      return false;
    }
    return canUserSeeWord(w, opts);
  });
}

/**
 * カテゴリ指定ありの対戦で使う単語。
 * 親子三代英語ゲーム（紐づいたカテゴリ）と、2人対戦のカテゴリ選択（共有カテゴリ）の両方から呼ぶ。
 * canUserSeeWord により、紐づいたカテゴリならプレミアム単語も通る。
 */
export function wordsForCategories(
  words: WordRow[],
  selectedCategories: string[],
  opts: WordVisibilityOptions,
): WordRow[] {
  return words.filter(
    w =>
      w.category !== null &&
      selectedCategories.includes(w.category) &&
      canUserSeeWord(w, opts),
  );
}
