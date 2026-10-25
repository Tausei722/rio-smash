import type { WordRow, CategoryAccessMap } from '../src/db/database';
import {
  isRestrictedCategory,
  isCategoryLinkedToUser,
  oyakoCategoriesForUser,
  sharedCategories,
  canUserSeeWord,
  wordsForOpenBattle,
  wordsForCategories,
} from '../src/utils/categoryVisibility';

// --- fixtures ---
const USER_A = 'user-a';
const USER_B = 'user-b';

// カテゴリ:
//  free-shared      … 紐づけ無し・全単語 is_premium=false
//  paid-shared      … 紐づけ無し・is_premium=true を含む
//  linked-a         … USER_A 専用・is_premium=true を含む
//  linked-b         … USER_B 専用
const access: CategoryAccessMap = {
  'linked-a': [USER_A],
  'linked-b': [USER_B],
};
const categories = ['free-shared', 'paid-shared', 'linked-a', 'linked-b'];

const w = (
  id: number,
  category: string | null,
  is_premium: boolean,
): WordRow => ({
  id,
  katakana: `k${id}`,
  english: `e${id}`,
  japanese: null,
  detail: null,
  audio_path: null,
  is_premium,
  category,
});

const words: WordRow[] = [
  w(1, 'free-shared', false),
  w(2, 'paid-shared', false),
  w(3, 'paid-shared', true),
  w(4, 'linked-a', false),
  w(5, 'linked-a', true),
  w(6, 'linked-b', true),
  w(7, null, false), // カテゴリ未設定
];

describe('isRestrictedCategory', () => {
  it('紐づけが1件でもあれば true', () => {
    expect(isRestrictedCategory('linked-a', access)).toBe(true);
  });
  it('紐づけが無ければ false', () => {
    expect(isRestrictedCategory('free-shared', access)).toBe(false);
  });
  it('空配列は共有扱い（false）', () => {
    expect(isRestrictedCategory('x', { x: [] })).toBe(false);
  });
});

describe('isCategoryLinkedToUser', () => {
  it('本人なら true', () => {
    expect(isCategoryLinkedToUser('linked-a', access, USER_A)).toBe(true);
  });
  it('別人なら false', () => {
    expect(isCategoryLinkedToUser('linked-a', access, USER_B)).toBe(false);
  });
  it('未ログイン(null)なら false', () => {
    expect(isCategoryLinkedToUser('linked-a', access, null)).toBe(false);
  });
  it('紐づけの無いカテゴリは false', () => {
    expect(isCategoryLinkedToUser('free-shared', access, USER_A)).toBe(false);
  });
});

describe('oyakoCategoriesForUser', () => {
  it('自分に紐づいたカテゴリだけ返す', () => {
    expect(oyakoCategoriesForUser(categories, access, USER_A)).toEqual(['linked-a']);
  });
  it('紐づけが無いユーザーは空（＝カード非表示）', () => {
    expect(oyakoCategoriesForUser(categories, access, 'nobody')).toEqual([]);
  });
  it('未ログインは空', () => {
    expect(oyakoCategoriesForUser(categories, access, null)).toEqual([]);
  });
});

describe('sharedCategories', () => {
  it('誰にも紐づいていないカテゴリだけ返す', () => {
    expect(sharedCategories(categories, access)).toEqual(['free-shared', 'paid-shared']);
  });
});

describe('canUserSeeWord', () => {
  const opts = (isPremium: boolean, userId: string | null) => ({ access, userId, isPremium });

  it('無料単語は誰でも見える', () => {
    expect(canUserSeeWord(w(1, 'free-shared', false), opts(false, USER_A))).toBe(true);
  });
  it('有料単語は非プレミアムには見えない', () => {
    expect(canUserSeeWord(w(3, 'paid-shared', true), opts(false, USER_A))).toBe(false);
  });
  it('有料単語もプレミアム会員には見える', () => {
    expect(canUserSeeWord(w(3, 'paid-shared', true), opts(true, USER_A))).toBe(true);
  });
  it('決定A: 自分に紐づいたカテゴリの有料単語は非プレミアムでも見える', () => {
    expect(canUserSeeWord(w(5, 'linked-a', true), opts(false, USER_A))).toBe(true);
  });
  it('他人に紐づいたカテゴリの有料単語は非プレミアムには見えない', () => {
    expect(canUserSeeWord(w(6, 'linked-b', true), opts(false, USER_A))).toBe(false);
  });
});

describe('wordsForOpenBattle (カテゴリ無し2人対戦)', () => {
  it('決定C: 紐づけ済みカテゴリの単語は自分のものでも除外', () => {
    const res = wordsForOpenBattle(words, { access, userId: USER_A, isPremium: false });
    const cats = res.map(x => x.category);
    expect(cats).not.toContain('linked-a');
    expect(cats).not.toContain('linked-b');
  });
  it('非プレミアム: 共有の無料単語とカテゴリ無し単語だけ', () => {
    const res = wordsForOpenBattle(words, { access, userId: USER_A, isPremium: false });
    expect(res.map(x => x.id).sort()).toEqual([1, 2, 7]);
  });
  it('プレミアム: 共有の有料単語も入る（紐づけ済みは依然除外）', () => {
    const res = wordsForOpenBattle(words, { access, userId: USER_A, isPremium: true });
    expect(res.map(x => x.id).sort()).toEqual([1, 2, 3, 7]);
  });
});

describe('wordsForCategories', () => {
  it('親子三代ゲーム: 自分の紐づけカテゴリは有料単語も含め全部（非プレミアム）', () => {
    const res = wordsForCategories(words, ['linked-a'], {
      access,
      userId: USER_A,
      isPremium: false,
    });
    expect(res.map(x => x.id).sort()).toEqual([4, 5]);
  });
  it('カテゴリ選択2人対戦: 共有カテゴリは非プレミアムだと有料単語が落ちる', () => {
    const res = wordsForCategories(words, ['paid-shared'], {
      access,
      userId: USER_A,
      isPremium: false,
    });
    expect(res.map(x => x.id).sort()).toEqual([2]);
  });
  it('カテゴリ選択2人対戦: プレミアムなら共有カテゴリの有料単語も入る', () => {
    const res = wordsForCategories(words, ['paid-shared'], {
      access,
      userId: USER_A,
      isPremium: true,
    });
    expect(res.map(x => x.id).sort()).toEqual([2, 3]);
  });
  it('他人の紐づけカテゴリを指定しても非プレミアムには有料単語が出ない', () => {
    const res = wordsForCategories(words, ['linked-b'], {
      access,
      userId: USER_A,
      isPremium: false,
    });
    expect(res).toEqual([]);
  });
});
