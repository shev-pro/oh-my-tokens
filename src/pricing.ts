export type Rate = {
  in: number;
  out: number;
  cc: number;
  cr: number;
  th?: number;
  in_hi?: number;
  out_hi?: number;
  cc_hi?: number;
  cr_hi?: number;
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
    th: 200_000,
    in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-sonnet-4-5-20250929": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000,
    in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-sonnet-4-6": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000,
    in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
  "claude-sonnet-4-20250514": {
    in: 3e-6, out: 1.5e-5, cc: 3.75e-6, cr: 3e-7,
    th: 200_000,
    in_hi: 6e-6, out_hi: 2.25e-5, cc_hi: 7.5e-6, cr_hi: 6e-7,
  },
};

const DATED_SUFFIX = /-\d{8}$/;
const VERTEX_VRANGE = /-v\d+:\d+$/;
const CONTEXT_MARKER = /\[\d+m\]$/;

export function normalizeClaudeModel(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("anthropic.")) s = s.slice("anthropic.".length);
  if (s.includes("claude-") && s.includes(".")) {
    const tail = s.split(".").pop()!;
    if (tail.startsWith("claude-")) s = tail;
  }
  s = s.replace(VERTEX_VRANGE, "");
  s = s.replace(CONTEXT_MARKER, "");
  const m = s.match(DATED_SUFFIX);
  if (m) {
    const base = s.slice(0, m.index!);
    if (base in CLAUDE_PRICING) return base;
  }
  return s;
}

function tier(tokens: number, base: number, hi: number | undefined, threshold: number | undefined): number {
  const t = Math.max(0, tokens);
  if (threshold === undefined || hi === undefined) return t * base;
  const below = Math.min(t, threshold);
  const over = Math.max(t - threshold, 0);
  return below * base + over * hi;
}

export function claudeCostUsd(model: string, inp: number, cacheRead: number, cacheCreate: number, out: number): number | null {
  const key = normalizeClaudeModel(model);
  const p = CLAUDE_PRICING[key];
  if (!p) return null;
  return (
    tier(inp, p.in, p.in_hi, p.th) +
    tier(cacheRead, p.cr, p.cr_hi, p.th) +
    tier(cacheCreate, p.cc, p.cc_hi, p.th) +
    tier(out, p.out, p.out_hi, p.th)
  );
}
