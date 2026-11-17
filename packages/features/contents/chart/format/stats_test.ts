// 平文譜面のイベント列の解析(parseEvents)と統計量(chartStats)を、
// バイト列を自分で組み立てて見る。原盤は読まない。
import { chartStats, parseEvents } from "./stats.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const TERMINATOR_TICK = 0x7fff;

/** F1・F2形式(4バイト/イベント・16bit tick)の1イベント */
function shortEvent(tick: number, cmd: number, p4: number, c2: number) {
  return [tick & 0xff, (tick >> 8) & 0xff, (cmd & 0x0f) | (p4 << 4), c2];
}

/** F3形式(8バイト/イベント・32bit tick)の1イベント */
function wideEvent(
  tick: number,
  cmd: number,
  p4: number,
  c2: number,
  param: number,
) {
  return [
    tick & 0xff,
    (tick >> 8) & 0xff,
    (tick >> 16) & 0xff,
    (tick >> 24) & 0xff,
    (cmd & 0x0f) | (p4 << 4),
    c2,
    param & 0xff,
    (param >> 8) & 0xff,
  ];
}

const shortTerminator = () => shortEvent(TERMINATOR_TICK, 0, 0, 0);
const wideTerminator = () => [
  TERMINATOR_TICK & 0xff,
  (TERMINATOR_TICK >> 8) & 0xff,
  (TERMINATOR_TICK >> 16) & 0xff,
  (TERMINATOR_TICK >> 24) & 0xff,
];

Deno.test("F1形式はヘッダー無しで16bit tickを読む", () => {
  const bytes = [
    ...shortEvent(0x10, 0, 0, 0),
    ...shortEvent(0x20, 1, 0, 0),
    ...shortTerminator(),
  ];
  const events = parseEvents(new Uint8Array(bytes), "F1");
  if (events === null) throw new Error("parseEventsがnullを返した");
  assertEquals(events.length, 2, "イベント数");
  assertEquals(events[0].tick, 0x10, "先頭tick");
  assertEquals(events[1].cmd, 1, "2件目のcmd");
});

Deno.test("F2形式はF1と同じ並びだが8バイトヘッダーを読み飛ばす", () => {
  const bytes = [
    ...new Array(8).fill(0),
    ...shortEvent(0x05, 0, 0, 0),
    ...shortTerminator(),
  ];
  const events = parseEvents(new Uint8Array(bytes), "F2");
  if (events === null) throw new Error("parseEventsがnullを返した");
  assertEquals(events.length, 1, "イベント数");
  assertEquals(events[0].tick, 0x05, "ヘッダーを読み飛ばした後のtick");
});

Deno.test("F3形式はBPMの上位bitをp4から合成し、統計量に集計する", () => {
  const bytes = [
    ...new Array(8).fill(0),
    ...wideEvent(5, 4, 0, 120, 0), // BPM 120
    ...wideEvent(10, 0, 0, 0, 0), // P1ノーツ(カウント対象)
    ...wideEvent(20, 1, 0, 1, 0), // P2ノーツ(カウント対象外、c2!=0)
    ...wideEvent(25, 4, 1, 44, 0), // BPM 300(p4がbit8として効く)
    ...wideEvent(30, 7, 0, 0, 2), // BGM開始(param=2)
    ...wideTerminator(),
  ];
  const events = parseEvents(new Uint8Array(bytes), "F3");
  if (events === null) throw new Error("parseEventsがnullを返した");
  const stats = chartStats(events);
  assertEquals(stats.p1, 1, "p1(カウント対象)");
  assertEquals(stats.p2, 0, "p2(カウント対象)");
  assertEquals(stats.p2All, 1, "p2All(カウント対象外も含む)");
  assertEquals(stats.totalAll, 2, "totalAll");
  assertEquals(stats.bpmFirst, 120, "先頭BPM");
  assertEquals(stats.bpmMin, 120, "最小BPM");
  assertEquals(stats.bpmMax, 300, "最大BPM");
  assertEquals(stats.bgmTick, 30, "BGM開始tick");
  assertEquals(stats.firstNoteTick, 10, "最初のカウント対象ノーツ");
  assertEquals(stats.lastTick, 30, "最終イベントのtick");
});

Deno.test("イベント列が途中で切れているとnullを返す", () => {
  // ヘッダー8バイトの後、tick分の4バイトしか無くF3の8バイト目まで届かない
  const bytes = [...new Array(8).fill(0), 1, 0, 0, 0];
  assertEquals(parseEvents(new Uint8Array(bytes), "F3"), null, "壊れた譜面");
});
