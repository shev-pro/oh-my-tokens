import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { normalizeClaudeModel, claudeCostUsd } from "./pricing.js";

export type Row = {
  dayKey: string;
  model: string;
  messageId: string | null;
  requestId: string | null;
  isSidechain: boolean;
  pathRole: "parent" | "subagent";
  inp: number;
  cacheRead: number;
  cacheCreate: number;
  out: number;
  cost: number | null;
};

export type Bucket = { input: number; cache_read: number; cache_create: number; output: number; cost: number };
export type Days = Record<string, Record<string, Bucket>>;

export function claudeRoots(): string[] {
  const env = (process.env.CLAUDE_CONFIG_DIR ?? "").trim();
  if (env) {
    return env.split(",").map(p => p.trim()).filter(Boolean).map(p => {
      return p.endsWith("projects") || p.endsWith("/projects") ? p : join(p, "projects");
    });
  }
  const h = homedir();
  return [join(h, ".config/claude/projects"), join(h, ".claude/projects")];
}

export function dayKeyFromTimestamp(ts: string): string | null {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function pathRole(p: string): "parent" | "subagent" {
  return p.includes("/subagents/") ? "subagent" : "parent";
}

function* walk(dir: string): Generator<string> {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (e.isFile() && e.name.endsWith(".jsonl")) yield full;
  }
}

const MAX_LINE = 512 * 1024;

export function parseFile(path: string): Row[] {
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch {
    return [];
  }
  const role = pathRole(path);
  const keyed = new Map<string, Row>();
  const unkeyed: Row[] = [];

  let start = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      const len = i - start;
      if (len > 0 && len <= MAX_LINE) {
        const slice = buf.subarray(start, i);
        // cheap byte prefilter
        const s = slice.toString("utf8");
        if (s.includes('"type":"assistant"') && s.includes('"usage"')) {
          let obj: any;
          try { obj = JSON.parse(s); } catch { start = i + 1; continue; }
          if (obj?.type === "assistant" && typeof obj.timestamp === "string") {
            const day = dayKeyFromTimestamp(obj.timestamp);
            const msg = obj.message;
            if (day && msg && typeof msg === "object" && typeof msg.model === "string" && msg.usage && typeof msg.usage === "object") {
              const u = msg.usage;
              const inp = Math.max(0, Number(u.input_tokens) || 0);
              const cc = Math.max(0, Number(u.cache_creation_input_tokens) || 0);
              const cr = Math.max(0, Number(u.cache_read_input_tokens) || 0);
              const out = Math.max(0, Number(u.output_tokens) || 0);
              if (inp || cc || cr || out) {
                const cost = claudeCostUsd(msg.model, inp, cr, cc, out);
                const mid = typeof msg.id === "string" ? msg.id : null;
                const rid = typeof obj.requestId === "string" ? obj.requestId : null;
                const row: Row = {
                  dayKey: day,
                  model: normalizeClaudeModel(msg.model),
                  messageId: mid,
                  requestId: rid,
                  isSidechain: !!obj.isSidechain,
                  pathRole: role,
                  inp, cacheRead: cr, cacheCreate: cc, out,
                  cost,
                };
                if (mid && rid) keyed.set(`${mid}:${rid}`, row);
                else unkeyed.push(row);
              }
            }
          }
        }
      }
      start = i + 1;
    }
  }
  return [...keyed.values(), ...unkeyed];
}

export function scanRoot(root: string): Array<{ path: string; row: Row }> {
  if (!existsSync(root)) return [];
  const out: Array<{ path: string; row: Row }> = [];
  for (const f of walk(root)) {
    try {
      if (statSync(f).size === 0) continue;
    } catch { continue; }
    for (const row of parseFile(f)) out.push({ path: f, row });
  }
  return out;
}

function rowWins(lhs: { path: string; row: Row }, rhs: { path: string; row: Row }): boolean {
  if (lhs.row.isSidechain !== rhs.row.isSidechain) return rhs.row.isSidechain;
  if (lhs.row.pathRole !== rhs.row.pathRole) return rhs.row.pathRole === "subagent";
  return lhs.path < rhs.path;
}

export function aggregate(rows: Array<{ path: string; row: Row }>): Days {
  const winners = new Map<string, { path: string; row: Row }>();
  const unkeyed: Row[] = [];
  rows.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  for (const item of rows) {
    const { row } = item;
    if (row.messageId && row.requestId) {
      const k = `${row.messageId}:${row.requestId}`;
      const ex = winners.get(k);
      if (!ex || rowWins(item, ex)) winners.set(k, item);
    } else {
      unkeyed.push(row);
    }
  }

  const days: Days = {};
  const add = (row: Row) => {
    const day = (days[row.dayKey] ??= {});
    const b = (day[row.model] ??= { input: 0, cache_read: 0, cache_create: 0, output: 0, cost: 0 });
    b.input += row.inp;
    b.cache_read += row.cacheRead;
    b.cache_create += row.cacheCreate;
    b.output += row.out;
    b.cost += row.cost ?? 0;
  };
  for (const { row } of winners.values()) add(row);
  for (const row of unkeyed) add(row);
  return days;
}

export function loadDays(): Days {
  const all: Array<{ path: string; row: Row }> = [];
  for (const r of claudeRoots()) all.push(...scanRoot(r));
  return aggregate(all);
}
