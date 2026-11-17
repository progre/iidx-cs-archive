// 旧キー音バンクに無いsound_idの扱いで、ISOの確認では気付きにくい壊れ方だけを見る。
// バイト列はテストの中で組み立て、原盤は読まない。
import { readF3, writeF3 } from "../format/mod.ts";
import {
  resolveUnknownSounds,
  UNKNOWN_SOUND_ID,
  withUnknownSounds,
} from "./unknown_sound.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

const NOTE_P1 = 0;
const SAMPLE_P1 = 2;
const AUTO = 7;

function eventOf(tick: number, cmd: number, param: number) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, tick, true);
  bytes[4] = cmd;
  view.setUint16(6, param, true);
  return { bytes, cmd, param, tick };
}

const header = Uint8Array.of(8, 0, 0, 0, 0x2b, 0x41, 0, 0);

Deno.test("BGMの開始の1と2は目印へ写さない", () => {
  const map = withUnknownSounds({ "5": 3 }, [1, 2, 3, 5]);
  assertEquals(JSON.stringify(map), `{"3":${UNKNOWN_SOUND_ID},"5":3}`, "対応");
});

Deno.test("自動再生音を取り除いた後も、後ろのイベントと終端を読み直せる", () => {
  const chart = writeF3({
    events: [
      eventOf(0, AUTO, 1),
      eventOf(60, AUTO, UNKNOWN_SOUND_ID),
      eventOf(60, SAMPLE_P1, UNKNOWN_SOUND_ID),
      eventOf(95, NOTE_P1, 0),
    ],
    header,
  });
  const resolved = resolveUnknownSounds(chart);
  const events = readF3(resolved).events
    .map((e) => `${e.tick}:${e.cmd}:${e.param}`).join(" ");
  assertEquals(events, "0:7:1 60:2:2 95:0:0", "残るイベント");
  assertEquals(resolved.length, 8 + 3 * 8 + 4, "長さ");
});
