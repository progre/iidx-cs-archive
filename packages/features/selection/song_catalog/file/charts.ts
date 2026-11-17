// 全曲リストの譜面の列名。列の並びの順である。

import type { Chart } from "@csa/core";

export const CHARTS = [
  "sb",
  "sn",
  "sh",
  "sa",
  "sl",
  "db",
  "dn",
  "dh",
  "da",
  "dl",
] as const satisfies readonly Chart[];

export type { Chart };

export const isChart = (text: string | undefined): text is Chart =>
  (CHARTS as readonly string[]).includes(text ?? "");
