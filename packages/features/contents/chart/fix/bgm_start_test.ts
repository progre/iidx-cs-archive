// BGM開始の参照をPBの形へ直す処理(normalizeBgmStart)を、
// バイト列を自分で組み立てて見る。原盤は読まない。
import { normalizeBgmStart } from "./bgm_start.ts";
import { parseEvents } from "../format/mod.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const AUTO = 7;
const SAMPLE_P1 = 2;
const NOTE_P1 = 0;

interface Event {
  tick: number;
  cmd: number;
  param: number;
}

/** F3形式の譜面。ヘッダ8バイト、8バイト/イベント、4バイトの終端 */
function chartOf(events: Event[]): Uint8Array {
  const out = new Uint8Array(8 + events.length * 8 + 4);
  const view = new DataView(out.buffer);
  view.setUint32(0, 8, true);
  view.setUint32(4, 0x412b, true);
  events.forEach((event, i) => {
    const at = 8 + i * 8;
    view.setUint32(at, event.tick, true);
    out[at + 4] = event.cmd;
    view.setUint16(at + 6, event.param, true);
  });
  view.setUint32(out.length - 4, 0x7fff, true);
  return out;
}

/** 読み直したイベントを `tick:cmd:param` の並びにする */
function describe(chart: Uint8Array): string {
  const events = parseEvents(chart, "F3");
  if (events === null) {
    throw new Error("イベント列が途中で切れている");
  }
  return events.map((e) => `${e.tick}:${e.cmd}:${e.param}`).join(" ");
}

Deno.test("曲頭より後の1と2を取り除き、曲頭の組は残す", () => {
  const chart = chartOf([
    { tick: 0, cmd: AUTO, param: 1 },
    { tick: 0, cmd: AUTO, param: 2 },
    { tick: 95, cmd: NOTE_P1, param: 0 },
    { tick: 143, cmd: AUTO, param: 1 },
    { tick: 143, cmd: AUTO, param: 2 },
    { tick: 190, cmd: NOTE_P1, param: 0 },
  ]);
  const dropped = normalizeBgmStart(chart);
  assertEquals(describe(dropped), "0:7:1 0:7:2 95:0:0 190:0:0", "残るイベント");
  assertEquals(dropped.length, 8 + 4 * 8 + 4, "長さ");
  assertEquals(
    new DataView(dropped.buffer).getUint32(dropped.length - 4, true),
    0x7fff,
    "終端",
  );
});

Deno.test("最初の参照が曲頭でなくても、そのtickを開始とみなす", () => {
  const chart = chartOf([
    { tick: 132, cmd: AUTO, param: 1 },
    { tick: 132, cmd: AUTO, param: 2 },
    { tick: 250, cmd: AUTO, param: 1 },
    { tick: 250, cmd: AUTO, param: 2 },
  ]);
  assertEquals(
    describe(normalizeBgmStart(chart)),
    "132:7:1 132:7:2",
    "残るイベント",
  );
});

Deno.test("1と2以外の自動再生音と、キー音割当の2は残す", () => {
  const chart = chartOf([
    { tick: 0, cmd: AUTO, param: 1 },
    { tick: 0, cmd: AUTO, param: 2 },
    { tick: 60, cmd: AUTO, param: 3 },
    { tick: 60, cmd: SAMPLE_P1, param: 2 },
  ]);
  assertEquals(normalizeBgmStart(chart), chart, "同じ配列を返す");
});

Deno.test("最初のtickに1が無ければ、そこの2を1へ書き換える", () => {
  const chart = chartOf([
    { tick: 85, cmd: AUTO, param: 2 },
    { tick: 95, cmd: NOTE_P1, param: 0 },
    { tick: 143, cmd: AUTO, param: 2 },
  ]);
  const normalized = normalizeBgmStart(chart);
  assertEquals(describe(normalized), "85:7:1 95:0:0", "残るイベント");
  assertEquals(describe(chart), "85:7:2 95:0:0 143:7:2", "引数は変えない");
});

Deno.test("最初のtickに1があれば、同じtickの2は書き換えない", () => {
  const chart = chartOf([
    { tick: 85, cmd: AUTO, param: 2 },
    { tick: 85, cmd: AUTO, param: 1 },
  ]);
  assertEquals(normalizeBgmStart(chart), chart, "同じ配列を返す");
});

Deno.test("終端の無い譜面は止める", () => {
  const chart = chartOf([{ tick: 0, cmd: AUTO, param: 1 }]).subarray(0, 16);
  let thrown = false;
  try {
    normalizeBgmStart(chart);
  } catch {
    thrown = true;
  }
  assertEquals(thrown, true, "例外が出る");
});
