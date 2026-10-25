// アイコンの規則はここだけ。個別画面で size / strokeWidth を即値で書かない。
// 仕様: docs/spec-icon-system.md
export const ICON = {
  size: { sm: 16, md: 20, lg: 24, xl: 32 },
  stroke: 1.75, // Lucide 既定の 2 は太め。1.75 で上品に。
} as const;

export type IconSize = keyof typeof ICON.size;
