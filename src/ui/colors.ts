const PALETTE = ["cyan", "magenta", "yellow", "green", "blue", "red", "white", "gray"] as const;

export type ColorName = typeof PALETTE[number];

export function modelColor(model: string, knownModels: string[]): ColorName {
  const idx = knownModels.indexOf(model);
  return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
}

export function fmtTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

export function fmtUsd(n: number): string {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
