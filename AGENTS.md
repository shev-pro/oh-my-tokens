# oh-my-tokens

Terminal UI for visualizing Claude Code token usage and cost from local CLI logs. Pure offline computation — scans `~/.claude/projects/**/*.jsonl`, applies a hardcoded pricing table, renders an Ink/React TUI with three time-window tabs and a stacked bar histogram per model.

## Tech Stack

- **Language:** TypeScript (ESM)
- **Runtime:** Node.js 18+
- **TUI:** Ink 5 + React 18
- **Dev runner:** `tsx`
- **Build:** `tsc` → `dist/`
- **Database:** none — reads JSONL session logs from disk
- **Deployment:** local CLI, no infra

## Project Structure

```
├── src/
│   ├── cli.tsx          # Entry point — scan logs, render <App/>
│   ├── pricing.ts       # CLAUDE_PRICING + normalize + tiered cost
│   ├── scanner.ts       # roots, JSONL walk, dedup, aggregate
│   ├── data.ts          # window slicing, date range helpers
│   └── ui/
│       ├── App.tsx      # tabs + key handler
│       ├── Summary.tsx  # totals + per-model table
│       ├── Histogram.tsx# stacked horizontal bars per day
│       ├── TodayBar.tsx # single per-model breakdown bar
│       └── colors.ts    # palette + format helpers
├── docs/                # Lumen documentation
├── dist/                # tsc output (gitignored)
└── README.md
```

## Key Entry Points

- **CLI entry:** `src/cli.tsx` — calls `loadDays()` then `render(<App/>)`.
- **Top-level scan:** `src/scanner.ts:loadDays` → returns `Days` map.
- **Pricing lookup:** `src/pricing.ts:claudeCostUsd`.
- **TUI root:** `src/ui/App.tsx`.

## Documentation Index

- [High-Level Design](docs/high-level-design.md) — Architecture, data flow, key decisions
- [Pricing](docs/pricing/README.md) — Price table, normalization, tiered cost
- [Scanner](docs/scanner/README.md) — Log discovery, parsing, dedup, aggregation
- [UI](docs/ui/README.md) — Ink components, tabs, stacked bar math
- [Rationale](docs/rationale.md) — Non-obvious decisions (dedup, tiered pricing, tie-breaks)
- [Log](docs/log.md) — Lumen operation history

## Development

```bash
npm install
npm start              # tsx, no build
npm run build          # → dist/
./dist/cli.js          # run built binary
```

Typecheck only: `npx tsc --noEmit`.

## Configuration

- `CLAUDE_CONFIG_DIR` — comma-separated list of paths. Each entry is treated as either a `projects` directory or its parent. Empty → fallback to `~/.config/claude/projects` and `~/.claude/projects`.

## Metadata

| Field | Value |
|-------|-------|
| **Managed by** | [Lumen](https://github.com/) — project knowledge keeper skill |
| **Project type** | CLI Tool (TUI) |
| **Domain complexity** | Medium |
| **Integration density** | 0 |
| **Scan depths** | Deep: pricing, scanner · Standard: ui |
| **Fingerprint status** | active |
| **Last scan** | 2026-04-30 |
| **Last ingest** | — |
| **Last lint** | — |
| **Last update commit** | (pre-Lumen) 1f60b63 |
| **Lumen version** | 2.0 |
