// Levenshtein距離でスコアを計算する
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// 0〜100点のスコアを返す
export function calcPronunciationScore(spoken: string, expected: string): number {
  const a = spoken.toLowerCase().trim();
  const b = expected.toLowerCase().trim();
  if (!a) return 0;
  if (a === b) return 100;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

// スコアに応じたメッセージ
export function scoreMessage(score: number): string {
  if (score === 100) return '完璧！';
  if (score >= 80) return 'すごい！';
  if (score >= 60) return 'いいね！';
  if (score >= 40) return 'もう少し！';
  return 'がんばろう！';
}

// スコアに応じた色
export function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'; // green
  if (score >= 60) return '#f59e0b'; // amber
  return '#ef4444'; // red
}
