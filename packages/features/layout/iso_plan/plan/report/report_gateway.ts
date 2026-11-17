// 配置計画のTSVを書く。`--write-plan`を付けたときだけ呼ぶ。I/Oだけを行う。

import { dirname } from "@std/path";
import { INTERMEDIATE_DIRECTORY } from "@csa/core";

const PLAN_REPORT = `${INTERMEDIATE_DIRECTORY}/iso/individual_asset_plan.tsv`;

export function writePlanReport(text: string): void {
  Deno.mkdirSync(dirname(PLAN_REPORT), { recursive: true });
  Deno.writeTextFileSync(PLAN_REPORT, text);
}
