# Rationale

Non-obvious decisions in `oh-my-tokens` that deviate from common patterns or are easy to get wrong on a casual read, with reasoning.

> Built incrementally during codebase exploration. Each entry captures something that looks unusual and why it exists.

---

### Streaming dedup uses cumulative-usage chunks → key on `messageId:requestId`

- **Date:** 2026-04-30
- **Status:** active
- **Context:** Claude streaming responses produce multiple assistant chunks that share `message.id` and `requestId`. Each chunk carries the **cumulative** usage so far, not the delta. Naive aggregation (sum every assistant row) overcounts massively — a 10-chunk turn would be counted ~5.5× total tokens.
- **Decision:** Within a file, key rows on `${messageId}:${requestId}` and let the last write win — that final chunk holds the final cumulative usage. Across files, repeat the dedup on the same canonical key.
- **Alternatives considered:**
  - **Sum all chunks** — wrong; cumulative semantics make it overcount.
  - **Diff consecutive chunks** — fragile; missing intermediate chunks (truncated logs) breaks it.
  - **Use `sessionId` in the key** — older logs often miss it; `messageId+requestId` is unique enough in practice.
- **Rationale:** Streaming format is fixed, last chunk is authoritative, and "last write wins" is O(1) per row with a `Map`. Simpler and robust to truncation.
- **Where:** `src/scanner.ts:parseFile` (in-file), `src/scanner.ts:aggregate` (cross-file).

---

### Cross-file tie-break: non-sidechain → parent → lexicographic path

- **Date:** 2026-04-30
- **Status:** active
- **Context:** The same `messageId:requestId` can appear in multiple JSONL files when the CLI duplicates events into sidechain logs or subagent transcripts. Picking the wrong copy can skew totals (e.g. a subagent file may carry a partial view).
- **Decision:** When the same canonical key collides across files, prefer in this order: (1) non-`isSidechain` over sidechain; (2) parent path over any path containing `/subagents/`; (3) lexicographically smaller file path as a final deterministic fallback.
- **Alternatives considered:**
  - **Latest mtime wins** — non-deterministic across machines and filesystem touches.
  - **Sum all copies** — would re-introduce the overcount the dedup is supposed to prevent.
- **Rationale:** Mirrors the upstream "primary log is parent, non-sidechain" convention and gives a stable result regardless of scan order.
- **Where:** `src/scanner.ts:rowWins`.

---

### Sonnet 4.x tiered pricing applied per bucket, not on the sum

- **Date:** 2026-04-30
- **Status:** active
- **Context:** Sonnet 4.x has a 200k-token threshold above which all four rates double. The "obvious" implementation — sum all four token buckets, then split at 200k — would give the wrong answer because the threshold is per-bucket in upstream pricing.
- **Decision:** Apply the threshold inside `tier()` independently for each of input / cache_read / cache_create / output. A row with 150k input + 150k output stays entirely on the base rates (neither bucket crossed 200k); a row with 250k input + 0 output splits only the input bucket.
- **Alternatives considered:**
  - **Tier on combined token count** — incorrect per the upstream price spec.
  - **No tiering** — undercharges high-volume Sonnet usage.
- **Rationale:** Correctness vs upstream. Implementation cost is a single helper called four times per row.
- **Where:** `src/pricing.ts:tier`, `src/pricing.ts:claudeCostUsd`.

---

### Dated suffix stripped only when the base model is in the price table

- **Date:** 2026-04-30
- **Status:** active
- **Context:** Claude model strings sometimes carry a trailing `-YYYYMMDD` build date (e.g. `claude-sonnet-4-5-20250929`). Always stripping the date would map unknown future-dated builds onto wrong rates if a similarly-named older model exists; never stripping it would miss known dated variants of priced models.
- **Decision:** In `normalizeClaudeModel`, strip the `-YYYYMMDD` suffix **only if** the resulting base name exists as a key in `CLAUDE_PRICING`. Otherwise keep the dated form so the lookup falls through to the dated entry (or returns `null`).
- **Alternatives considered:**
  - **Always strip** — risks silently mispricing a new model whose base name happens to match an older one.
  - **Never strip** — every dated build would need an explicit price entry.
- **Rationale:** Lets us add only the bare entry for new models and have all future-dated builds price correctly, while still letting an explicit dated entry override.
- **Where:** `src/pricing.ts:normalizeClaudeModel`.

---

### No persistent cache — always full rescan

- **Date:** 2026-04-30
- **Status:** active
- **Context:** Upstream caches per-row cost as integer nanodollars and parses incrementally. That's complexity worth carrying for a menu-bar app polling every few seconds, but `oh-my-tokens` is launched, used briefly, and quit.
- **Decision:** Rescan all JSONL files on every launch. Keep cost as `number` (float) — drift is invisible at display precision.
- **Alternatives considered:**
  - **Persistent cache file** — adds invalidation logic, file format, version migrations.
  - **Integer nanodollars** — needed only if many cache rebuilds compound float error.
- **Rationale:** Typical scan completes in well under a second on a year of logs. Simplicity beats marginal speedup.
- **Where:** `src/cli.tsx`, `src/scanner.ts`.

---

### TUI reads only Claude Code CLI logs on the local machine

- **Date:** 2026-04-30
- **Status:** active
- **Context:** Users may expect the tool to show "all my Claude usage". It cannot — claude.ai web, desktop/mobile apps, and Console/API calls outside the CLI write no local JSONL.
- **Decision:** Restrict scope explicitly to `~/.claude/projects/**/*.jsonl` (and `$CLAUDE_CONFIG_DIR`). Document the limitation prominently in `README.md`.
- **Alternatives considered:**
  - **Pull from Anthropic Console API** — requires API key + admin scope; not local; out of scope for an offline tool.
  - **Cross-machine sync** — out of scope; user can copy JSONL files manually.
- **Rationale:** Offline, no-credentials, single-purpose. Matches the data that actually exists on disk.
- **Where:** `src/scanner.ts:claudeRoots`, `README.md` Limitations section.
