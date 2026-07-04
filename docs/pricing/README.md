# Pricing

Hardcoded Claude per-token USD price table plus model-name normalization and tiered cost computation. Pure functions, no I/O.

## Responsibility

- Owns `CLAUDE_PRICING` — the single source of truth for cost rates.
- Maps any raw `message.model` string (CLI, Bedrock, Vertex) to a canonical key via `normalizeClaudeModel()`.
- Computes per-row USD cost via `claudeCostUsd()` with optional tiered pricing.

Does **not** read files, dedup rows, or aggregate — that's `scanner`'s job.

## Architecture

```mermaid
graph TD
    RAW[raw model string] --> NORM[normalizeClaudeModel]
    NORM --> KEY[canonical key]
    KEY --> LOOK[CLAUDE_PRICING lookup]
    LOOK --> RATE[Rate]
    TOKENS[input/cache_read/cache_create/output] --> COST[claudeCostUsd]
    RATE --> COST
    COST --> USD[number | null]
```

## Key Files

- `src/pricing.ts` — entire component, ~70 lines.

## Key Interfaces / Types

- `Rate` — per-bucket rates plus optional tier fields → `src/pricing.ts:1`
- `CLAUDE_PRICING: Record<string, Rate>` → `src/pricing.ts:14`
- `normalizeClaudeModel(raw: string): string` → `src/pricing.ts:50`
- `claudeCostUsd(model, inp, cacheRead, cacheCreate, out): number | null` → `src/pricing.ts:75`

## Model Normalization

`normalizeClaudeModel()` strips, in order:

1. `anthropic.` prefix (Bedrock).
2. Vertex/Bedrock leading namespace: if string contains `claude-` and a `.`, take everything after the last `.` when the tail starts with `claude-` (handles `us.anthropic.claude-...`).
3. Bedrock version suffix matching `-vN:M` at end (e.g. `-v1:0`).
4. Context-window marker `[Nm]` at end (e.g. `claude-opus-4-8[1m]` → `claude-opus-4-8`) — the 1M-context variant shares the base model's rate.
5. Dated suffix `-YYYYMMDD` at end **only** if the resulting base model exists in the price table; otherwise keep the dated form.

Result: a key directly looked up in `CLAUDE_PRICING`. Unknown keys → cost `null`.

## Tiered Pricing

Sonnet 4.x has a 200k-token threshold per bucket: tokens above 200k use the `*_hi` rates. Tiering is **per-bucket** (input, output, cache_create, cache_read each split independently), not on the sum.

```ts
tier(t, base, hi, threshold):
  below = min(t, threshold)
  over  = max(t - threshold, 0)
  return below * base + over * hi
```

If `threshold` or `hi` is undefined, plain `t * base`.

## Time-based Pricing

Some models change rates over time. `claudeCostUsd()` accepts an optional `timestampMs` and swaps the rate table accordingly:

- **`HISTORICAL_PRICING`** — for requests **before** `LONG_CONTEXT_CUTOFF_MS` (~2026-03-13), `claude-sonnet-4-6` and `claude-opus-4-6` used long-context tiered rates. After the cutoff they bill flat.
- **`INTRO_PRICING`** — promotional launch rates applied **before** `INTRO_CUTOFF_MS` (2026-09-01 UTC). `claude-sonnet-5` bills at the introductory $2/$10 per MTok through 2026-08-31, then reverts to the standard $3/$15 in `CLAUDE_PRICING`.

Both overrides key by canonical model name and only apply when a `timestampMs` is supplied; without one, the standard `CLAUDE_PRICING` rate is used.

## Adding a New Model

When Anthropic ships a new model:

1. Add the bare entry (e.g. `"claude-foo-1"`).
2. Add any dated variants you care about (e.g. `"claude-foo-1-20260101"`).
3. If tiered, set `th`, `in_hi`, `out_hi`, `cc_hi`, `cr_hi`.
4. If it has launch/promo pricing, add the standard rate to `CLAUDE_PRICING` and the promo rate to `INTRO_PRICING` (see [Time-based Pricing](#time-based-pricing)).

`normalizeClaudeModel()` strips the dated suffix only when the base form is already a known key — so adding the bare entry is enough for future-dated builds of the same model.

## Configuration

None — pure constant table. Update via code edit.

## Dependencies

- **Internal:** none.
- **External:** none.

## Error Handling

Unknown model → `claudeCostUsd()` returns `null`. Caller (`scanner`) folds `null` into `cost: 0` so tokens still aggregate but cost stays out.

## Related Documents

- [High-Level Design](../high-level-design.md)
- [Scanner](../scanner/README.md)
- [Rationale](../rationale.md)
