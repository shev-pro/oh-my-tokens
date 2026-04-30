#!/usr/bin/env node
import React from "react";
import { render, Box, Text } from "ink";
import { loadDays } from "./scanner.js";
import { App } from "./ui/App.js";

function main() {
  // Scan synchronously; logs are local files.
  process.stderr.write("Scanning Claude logs...\n");
  const days = loadDays();
  render(<App days={days} />);
}

main();
