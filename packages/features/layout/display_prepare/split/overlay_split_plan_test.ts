// 場面ごとの分け方の選定を、組み立てたsheetの大きさで確かめる。

import { planOverlaySplit, type SplitScene } from "./overlay_split_plan.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const list = (values: Iterable<number>) =>
  [...values].sort((a, b) => a - b).join(" ");

const scenes = (...sheets: number[][]): SplitScene[] =>
  sheets.map((used, animation) => ({ animation, sheets: new Set(used) }));

const sizes = { headerBytes: 8, metadata: 100, sheets: [1500, 600, 600] };

Deno.test("上限に収まるなら1本のまま、収まらないなら場面ごとに分ける", () => {
  const both = scenes([0], [1, 2]);
  assertEquals(
    planOverlaySplit(both, sizes, 8, 2).length,
    1,
    "2 sectorsなら1本",
  );
  const parts = planOverlaySplit(both, sizes, 8, 1);
  assertEquals(parts.length, 2, "1 sectorなら2本");
  assertEquals(
    parts.map((part) => part.animations.join()).join("/"),
    "0/1",
    "場面の割り当て",
  );
  assertEquals(list(parts[1].sheets), "1 2", "2本目のsheet");
  assertEquals(
    parts.every((part) => part.sectors === 1),
    true,
    "各本のセクタ数",
  );
});

Deno.test("同じ本数なら最大の本が最小になる分け方を選ぶ", () => {
  const large = { headerBytes: 8, metadata: 0, sheets: [4000, 2000, 2000] };
  const parts = planOverlaySplit(scenes([0], [1], [2]), large, 8, 3);
  assertEquals(parts.length, 2, "本数");
  assertEquals(
    parts.map((part) => part.animations.join()).join("/"),
    "0/1,2",
    "大きい場面を1本へ寄せる",
  );
  assertEquals(Math.max(...parts.map((part) => part.sectors)), 2, "最大の本");
});

function message(run: () => void): string {
  try {
    run();
  } catch (error) {
    return String(error);
  }
  return "";
}

Deno.test("1場面で上限を超える本と枠に収まらない本は停止する", () => {
  const alone = message(() => planOverlaySplit(scenes([0, 1, 2]), sizes, 8, 1));
  if (!alone.includes("だけで")) throw new Error(`1場面の超過: ${alone}`);
  const budget = message(() =>
    planOverlaySplit(scenes([0], [1, 2]), sizes, 1, 1)
  );
  if (!budget.includes("収まる分け方が無い")) {
    throw new Error(`枠の超過: ${budget}`);
  }
});
