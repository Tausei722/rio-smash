/**
 * AdminScreen が本番相当のデータで描画時に throw しないかを確認する。
 * native 依存は全部モックして、純粋に render パスだけを走らせる。
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const RN = require('react-native');
  const Passthrough = ({ children, ...p }: any) => React.createElement(RN.View, p, children);
  return { SafeAreaView: Passthrough, SafeAreaProvider: Passthrough };
});

jest.mock('../src/components/Icon', () => ({
  Icon: () => null,
}));

// DB 層は全部モック（本番相当のデータを返す）
jest.mock('../src/db/database', () => {
  const words = Array.from({ length: 224 }, (_, i) => ({
    id: i + 1,
    katakana: `カタカナ${i}`,
    english: `word ${i}`,
    japanese: i % 3 === 0 ? null : `日本語${i}`,
    detail: null,
    audio_path: i % 2 === 0 ? 'https://example.com/a.m4a' : null,
    is_premium: i % 2 === 0,
    category: i % 5 === 0 ? null : `カテゴリ${i % 11}`,
  }));
  return {
    deleteWord: jest.fn(),
    fetchAllWords: jest.fn().mockResolvedValue(words),
    fetchAllProfiles: jest.fn().mockResolvedValue([]),
    fetchCategoryAccess: jest.fn().mockResolvedValue({}),
    assignCategoryToUser: jest.fn(),
    clearCategoryAccess: jest.fn(),
    renameCategoryAccess: jest.fn(),
  };
});

import { AdminScreen } from '../src/screens/AdminScreen';

const CATEGORIES = [
  'yesterday', 'ezdrxr', 'お土産', '挨拶', '試着', '写真', '道教え', '道迷い',
  '6歳以上', '6歳以下', 'monkey magic', 'ラップ', '放送禁止', '熟語',
  'レッスン1', 'レッスン2', 'レッスン3', '親子会話', 'ラーメン英語1', 'えーっと英語',
  '親子3代英語シーン別辞書「注意しなきゃ」', '親子3代英語シーン別辞書「褒めなきゃ」',
];

test('AdminScreen が本番相当データで描画時に throw しない', async () => {
  const noop = async (..._args: unknown[]) => {};
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AdminScreen
        onBack={() => {}}
        onAddWord={() => {}}
        onEditWord={() => {}}
        premiumCategories={new Set(['お土産', '写真'])}
        onSavePremiumCategories={noop}
        categories={CATEGORIES}
        onSaveCategories={noop}
        onRenameCategory={noop}
      />,
    );
  });
  // 非同期 load() / loadAccess() を消化
  await ReactTestRenderer.act(async () => {
    await new Promise<void>(r => { setTimeout(() => r(), 0); });
  });
  expect(tree).toBeDefined();
});
