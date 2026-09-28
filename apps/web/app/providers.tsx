"use client";

import { Theme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";

export function Providers({ children }: { children: React.ReactNode }) {
  return <Theme theme={butterTheme} mode="light">{children}</Theme>;
}
