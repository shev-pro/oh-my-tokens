import React, { useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { Days } from "../scanner.js";
import { sliceWindow, todayUtc, daysAgoUtc } from "../data.js";
import { Histogram } from "./Histogram.js";
import { Summary } from "./Summary.js";
import { TodayBar } from "./TodayBar.js";

type TabId = "today" | "7d" | "30d";
const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d",    label: "Last 7 days" },
  { id: "30d",   label: "Last 30 days" },
];

export function App({ days }: { days: Days }) {
  const { exit } = useApp();
  const [tab, setTab] = useState<TabId>("today");
  const [mode, setMode] = useState<"tokens" | "cost">("tokens");

  useInput((input, key) => {
    if (input === "q" || key.escape) exit();
    if (input === "1") setTab("today");
    if (input === "2") setTab("7d");
    if (input === "3") setTab("30d");
    if (key.leftArrow) {
      const i = TABS.findIndex(t => t.id === tab);
      setTab(TABS[(i - 1 + TABS.length) % TABS.length].id);
    }
    if (key.rightArrow) {
      const i = TABS.findIndex(t => t.id === tab);
      setTab(TABS[(i + 1) % TABS.length].id);
    }
    if (input === "m") setMode(m => m === "tokens" ? "cost" : "tokens");
  });

  const today = todayUtc();
  const window = useMemo(() => {
    if (tab === "today") return sliceWindow(days, today, today);
    if (tab === "7d")    return sliceWindow(days, daysAgoUtc(6), today);
    return sliceWindow(days, daysAgoUtc(29), today);
  }, [days, tab, today]);

  const label = TABS.find(t => t.id === tab)!.label;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="white">oh-my-tokens </Text>
        <Text dimColor>— Claude Code usage</Text>
      </Box>
      <Box marginTop={1}>
        {TABS.map(t => (
          <Box key={t.id} marginRight={2}>
            <Text
              bold={t.id === tab}
              color={t.id === tab ? "black" : "white"}
              backgroundColor={t.id === tab ? "cyan" : undefined}
            >
              {` ${t.label} `}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Summary data={window} label={label} />
        <Box marginTop={1} flexDirection="column">
          <Text bold>Histogram ({mode}, stacked by model)</Text>
          {tab === "today"
            ? <TodayBar data={window} mode={mode} />
            : <Histogram data={window} mode={mode} />}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          [1/2/3] tabs · [←/→] cycle · [m] toggle tokens/cost · [q] quit
        </Text>
      </Box>
    </Box>
  );
}
