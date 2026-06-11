export type Rate = {
  in: number; out: number; cc: number; cr: number;
  th?: number; in_hi?: number; out_hi?: number; cc_hi?: number; cr_hi?: number;
};

export const CLAUDE_PRICING: Record<string, Rate> = {
  "claude-haiku-4-5-20251001": { in: 1e-6, out: 5e-6, cc: 1.25e-6, cr: 1e-7 },
  "claude-haiku-4-5":          { in: 1e-6, out: 5e-6, cc: 1.25e-6, cr: 1e-7 },
  "claude-opus-4-5-20251101":  { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-5":           { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-6-20260205":  { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-6":           { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-7":           { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-8":           { in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7 },
  "claude-opus-4-1":           { in: 1.5e-5, out: 7.5e-5, cc: 1.875e-5, cr: 1.5e-6 },
  "claude-opus-4-20250514":    { in: 1.5e-5, out: 7.5e-5, cc: 1.875e-5, cr: 1.5e-6 },
  "claude-sonnet-4-5": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000, in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-sonnet-4-5-20250929": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000, in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  // Flat pricing since ~2026-03-12; historical tiered rates in HISTORICAL_PRICING
  "claude-sonnet-4-6":         { in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7 },
  "claude-sonnet-4-20250514": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000, in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-fable-5":            { in: 1e-5, out: 5e-5, cc: 1.25e-5, cr: 1e-6 },
};

// Before this timestamp claude-sonnet-4-6 and claude-opus-4-6 had long-context tiered pricing
const LONG_CONTEXT_CUTOFF_MS = 1_773_360_000_000;

// Historical pricing for models that switched to flat rates in March 2026
const HISTORICAL_PRICING: Record<string, Rate> = {
  "claude-sonnet-4-6": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000, in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-opus-4-6": {
    in: 5e-6, out: 2.5e-5, cc: 6.25e-6, cr: 5e-7,
    th: 200_000, in_hi: 1e-5, out_hi: 3.75e-5, cc_hi: 1.25e-5, cr_hi: 1e-6,
  },
};

const DATED_SUFFIX = /-\d{8}$/;
const VERTEX_VRANGE = /-v\d+:\d+$/;
const VERTEX_AT_VERSION = /@\d+$/;
const CONTEXT_MARKER = /\[\d+m\]$/;

export function normalizeClaudeModel(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("anthropic.")) s = s.slice("anthropic.".length);
  if (s.includes("claude-") && s.includes(".")) {
    const tail = s.split(".").pop()!;
    if (tail.startsWith("claude-")) s = tail;
  }
  s = s.replace(VERTEX_VRANGE, "");
  s = s.replace(VERTEX_AT_VERSION, "");
  s = s.replace(CONTEXT_MARKER, "");
  const m = s.match(DATED_SUFFIX);
  if (m) {
    const base = s.slice(0, m.index!);
    if (base in CLAUDE_PRICING) return base;
  }
  return s;
}

export function claudeCostUsd(
  model: string,
  inp: number,
  cacheRead: number,
  cacheCreate: number,
  out: number,
  cacheCreate1h = 0,
  timestampMs?: number,
): number | null {
  const key = normalizeClaudeModel(model);
  let p = CLAUDE_PRICING[key];
  if (!p) return null;

  // Apply historical tiered pricing for requests before the flat-rate cutoff
  if (timestampMs !== undefined && timestampMs < LONG_CONTEXT_CUTOFF_MS) {
    const hp = HISTORICAL_PRICING[key];
    if (hp) p = hp;
  }

  // All-or-nothing long-context threshold: if total input > threshold, all tokens
  // are billed at the higher rate (matches CodexBar / Anthropic actual pricing semantics)
  const totalInput = Math.max(0, inp) + Math.max(0, cacheRead) + Math.max(0, cacheCreate);
  const hi = p.th !== undefined && p.in_hi !== undefined && totalInput > p.th;

  const inRate  = hi ? (p.in_hi  ?? p.in)  : p.in;
  const crRate  = hi ? (p.cr_hi  ?? p.cr)  : p.cr;
  const ccRate  = hi ? (p.cc_hi  ?? p.cc)  : p.cc;
  const outRate = hi ? (p.out_hi ?? p.out) : p.out;

  // 1h TTL cache creation is priced at 2× input rate; 5m TTL uses the standard cc rate
  const cc1h = Math.max(0, Math.min(cacheCreate1h, cacheCreate));
  const cc5m = Math.max(0, cacheCreate) - cc1h;

  return (
    Math.max(0, inp)      * inRate +
    Math.max(0, cacheRead) * crRate +
    cc5m                  * ccRate +
    cc1h                  * inRate * 2 +
    Math.max(0, out)      * outRate
  );
}
