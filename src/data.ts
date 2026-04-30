import type { Days, Bucket } from "./scanner.js";

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgoUtc(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function dateRange(since: string, until: string): string[] {
  const out: string[] = [];
  const s = new Date(since + "T00:00:00Z");
  const u = new Date(until + "T00:00:00Z");
  for (let d = s; d <= u; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export type DayModel = { day: string; model: string; tokens: number; cost: number; bucket: Bucket };

export function bucketTokens(b: Bucket): number {
  return b.input + b.cache_read + b.cache_create + b.output;
}

export type WindowData = {
  days: string[];                          // chronological keys covering window
  perDay: Record<string, Record<string, Bucket>>; // sparse
  models: string[];                        // sorted by tokens desc within window
  totals: { tokens: number; cost: number };
  perModelTotals: Record<string, { tokens: number; cost: number }>;
};

export function sliceWindow(days: Days, since: string, until: string): WindowData {
  const range = dateRange(since, until);
  const perDay: Record<string, Record<string, Bucket>> = {};
  const perModelTotals: Record<string, { tokens: number; cost: number }> = {};
  let totalTokens = 0;
  let totalCost = 0;

  for (const day of range) {
    const m = days[day];
    if (!m) continue;
    perDay[day] = m;
    for (const [model, b] of Object.entries(m)) {
      const t = bucketTokens(b);
      totalTokens += t;
      totalCost += b.cost;
      const acc = (perModelTotals[model] ??= { tokens: 0, cost: 0 });
      acc.tokens += t;
      acc.cost += b.cost;
    }
  }

  const models = Object.keys(perModelTotals).sort((a, b) => perModelTotals[b].tokens - perModelTotals[a].tokens);
  return { days: range, perDay, models, totals: { tokens: totalTokens, cost: totalCost }, perModelTotals };
}
