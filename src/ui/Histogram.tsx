import React from "react";
import { Box, Text } from "ink";
import type { WindowData } from "../data.js";
import { bucketTokens } from "../data.js";
import { modelColor, fmtTokens, fmtUsd } from "./colors.js";

const BAR_WIDTH = 40;

function buildSegments(perModel: Record<string, { tokens: number }>, models: string[], totalTokens: number, barChars: number) {
  // Floor each segment, distribute remainder to largest fractional parts to preserve total.
  if (totalTokens === 0 || barChars === 0) return models.map(() => 0);
  const exact = models.map(m => (perModel[m]?.tokens ?? 0) / totalTokens * barChars);
  const floors = exact.map(Math.floor);
  let used = floors.reduce((a, b) => a + b, 0);
  const remainder = barChars - used;
  const fracIdx = exact
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, remainder)
    .map(x => x.i);
  for (const i of fracIdx) floors[i] += 1;
  return floors;
}

export function Histogram({ data, mode }: { data: WindowData; mode: "tokens" | "cost" }) {
  // For each day in window with data: one row. Day with no data: skipped or rendered empty.
  const daysWithData = data.days.filter(d => data.perDay[d]);
  if (daysWithData.length === 0) {
    return <Box><Text dimColor>No usage in window.</Text></Box>;
  }

  // Normalize bar widths to max day total in window.
  const dayTotals = daysWithData.map(d => {
    const m = data.perDay[d]!;
    let tokens = 0, cost = 0;
    for (const b of Object.values(m)) { tokens += bucketTokens(b); cost += b.cost; }
    return { day: d, tokens, cost };
  });
  const maxVal = Math.max(...dayTotals.map(d => mode === "tokens" ? d.tokens : d.cost));

  return (
    <Box flexDirection="column">
      {dayTotals.map(({ day, tokens, cost }) => {
        const m = data.perDay[day]!;
        const dayValue = mode === "tokens" ? tokens : cost;
        const barChars = maxVal > 0 ? Math.round(dayValue / maxVal * BAR_WIDTH) : 0;
        // Segments proportional to per-model contribution (in the chosen metric).
        const perModel: Record<string, { tokens: number }> = {};
        const totalForBar = dayValue;
        for (const model of data.models) {
          const b = m[model];
          const v = b ? (mode === "tokens" ? bucketTokens(b) : b.cost) : 0;
          perModel[model] = { tokens: v };
        }
        const segLens = buildSegments(perModel, data.models, totalForBar, barChars);

        return (
          <Box key={day}>
            <Box width={11}><Text>{day}</Text></Box>
            <Box width={BAR_WIDTH + 1}>
              {data.models.map((model, i) => {
                const len = segLens[i];
                if (len <= 0) return null;
                return <Text key={model} color={modelColor(model, data.models)}>{"█".repeat(len)}</Text>;
              })}
              {Array.from({ length: BAR_WIDTH - segLens.reduce((a, b) => a + b, 0) }).map((_, i) => (
                <Text key={`pad-${i}`} dimColor>·</Text>
              ))}
            </Box>
            <Box width={10}><Text>{" " + fmtTokens(tokens)}</Text></Box>
            <Box width={12}><Text>{" " + fmtUsd(cost)}</Text></Box>
          </Box>
        );
      })}
    </Box>
  );
}
