import React from "react";
import { Box, Text } from "ink";
import type { WindowData } from "../data.js";
import { modelColor, fmtTokens, fmtUsd } from "./colors.js";

export function Summary({ data, label }: { data: WindowData; label: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold>{label}: </Text>
        <Text color="green">{fmtUsd(data.totals.cost)}</Text>
        <Text> · </Text>
        <Text color="cyan">{fmtTokens(data.totals.tokens)} tokens</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Box width={32}><Text underline>Model</Text></Box>
          <Box width={12}><Text underline>Tokens</Text></Box>
          <Box width={12}><Text underline>Cost</Text></Box>
        </Box>
        {data.models.length === 0 && <Text dimColor>(no usage)</Text>}
        {data.models.map(m => {
          const t = data.perModelTotals[m];
          return (
            <Box key={m}>
              <Box width={32}>
                <Text color={modelColor(m, data.models)}>■ </Text>
                <Text>{m}</Text>
              </Box>
              <Box width={12}><Text>{fmtTokens(t.tokens)}</Text></Box>
              <Box width={12}><Text>{fmtUsd(t.cost)}</Text></Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
