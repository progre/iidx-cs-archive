// ノーツ数の数え方と、スロットから譜面名への直し方。実データを使わず、組み立てた譜面で確かめる。
// 実行: deno test packages/utils/chart_notes/note_counts_test.ts

import type { Chart } from "@csa/selection-song-catalog";
import { noteCountsOf, OUTPUT_HEADER, outputLine } from "./main.ts";

const PB_SLOTS: Chart[] = ["sh", "dh", "sa", "da", "sn", "dn", "sb", "db"];
const US_SLOTS: Chart[] = ["sn", "dn", "sh", "dh", "sa", "da", "sb", "db"];

function assertJson(actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${a} != ${e}`);
  }
}

interface Event {
  cmd: number;
  c2: number;
}

/** 8バイトのイベントを並べた平文譜面。先頭の8バイトはヘッダーで、終端はtick 0x7fff */
function chartOf(events: Event[]): Uint8Array {
  const bytes = new Uint8Array(8 + (events.length + 1) * 8);
  const view = new DataView(bytes.buffer);
  events.forEach(({ cmd, c2 }, index) => {
    const offset = 8 + index * 8;
    view.setUint32(offset, index + 1, true);
    bytes[offset + 4] = cmd;
    bytes[offset + 5] = c2;
  });
  view.setUint32(8 + events.length * 8, 0x7fff, true);
  return bytes;
}

const NOTE = { cmd: 0, c2: 0 };
const NOTE_2P = { cmd: 1, c2: 0 };

Deno.test("c2が0のノーツだけを数え、DPは1Pと2Pを足す", () => {
  const single = chartOf([NOTE, NOTE, { cmd: 0, c2: 1 }]);
  const double = chartOf([NOTE, NOTE_2P, NOTE_2P, { cmd: 4, c2: 120 }]);
  assertJson(
    noteCountsOf([single, double], "F3", PB_SLOTS),
    { sh: 2, dh: 3 },
  );
});

Deno.test("譜面が無いスロットは数えない", () => {
  const chart = chartOf([NOTE]);
  assertJson(
    noteCountsOf([null, null, null, null, chart], "F3", PB_SLOTS),
    { sn: 1 },
  );
});

Deno.test("出力の列は全曲リストの難易度の列と同じ並びで、無い譜面は空にする", () => {
  assertJson(
    OUTPUT_HEADER,
    "generation\ttitle\tsb\tsn\tsh\tsa\tsl\tdb\tdn\tdh\tda\tdl",
  );
  assertJson(
    outputLine("pb", "A:12", { sn: 100, sh: 200, dh: 300 }),
    "pb\tA:12\t\t100\t200\t\t\t\t\t300\t\t",
  );
});

Deno.test("usはスロット0がNORMAL、スロット2がHYPERになる", () => {
  const normal = chartOf([NOTE]);
  const hyper = chartOf([NOTE, NOTE]);
  assertJson(
    noteCountsOf([normal, null, hyper], "F3", US_SLOTS),
    { sn: 1, sh: 2 },
  );
});
