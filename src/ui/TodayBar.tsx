import React from "react";
import { Box, Text } from "ink";
import type { WindowData } from "../data.js";
import { modelColor, fmtTokens, fmtUsd } from "./colors.js";

const BAR_WIDTH = 60;

export function TodayBar({ data, mode }: { data: WindowData; mode: "tokens" | "cost" }) {
  const total = mode === "tokens" ? data.totals.tokens : data.totals.cost;
  if (total === 0 || data.models.length === 0) {
    return <Box><Text dimColor>No usage today.</Text></Box>;
  }

  const exact = data.models.map(m => {
    const v = mode === "tokens" ? data.perModelTotals[m].tokens : data.perModelTotals[m].cost;
    return v / total * BAR_WIDTH;
  });
  const floors = exact.map(Math.floor);
  let used = floors.reduce((a, b) => a + b, 0);
  const remainder = BAR_WIDTH - used;
  exact
    .map((v, i) => ({ frac: v - Math.floor(v), i }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, remainder)
    .forEach(({ i }) => { floors[i] += 1; });

  return (
    <Box flexDirection="column">
      <Text dimColor>{`Per-model breakdown (${mode}):`}</Text>
      <Box>
        {data.models.map((m, i) => {
          if (floors[i] <= 0) return null;
          return <Text key={m} color={modelColor(m, data.models)}>{"█".repeat(floors[i])}</Text>;
        })}
      </Box>
      <Box marginTop={1}>
        <Text>Total: </Text>
        <Text color="green">{fmtUsd(data.totals.cost)}</Text>
        <Text> · </Text>
        <Text color="cyan">{fmtTokens(data.totals.tokens)} tokens</Text>
      </Box>
    </Box>
  );
}
