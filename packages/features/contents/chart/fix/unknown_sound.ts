// era1の譜面が旧キー音バンクに無い`sound_id`を参照しても、原作と同じく何も鳴らさない。
// 原作のドライバーは`entry_id`で探して見つからなければ鳴らさない。一方`remapSoundIds`はsound mapに無い値を
// そのまま残すので、振り直した新バンクの別の音を指す。
import type { ChartFormat } from "@csa/core";
import { BGM_SOUND_IDS } from "./bgm_start.ts";
import { type ChartEvent, readF3, withParam, writeF3 } from "../format/mod.ts";

/** 旧バンクに無い`sound_id`の目印。新バンクの`entry_id`はここまで届かない */
export const UNKNOWN_SOUND_ID = 0xffff;
/** 新バンクの無音の埋草 */
const SILENT_SOUND_ID = 2;
const AUTO = 7;
/** sound_idを持つコマンド: sample_p1(2)・sample_p2(3)・auto(7) */
export const SOUND_COMMANDS: ReadonlySet<number> = new Set([2, 3, 7]);
const SOUND_CMDS = SOUND_COMMANDS;

/** 平文譜面のイベントが参照する`sound_id`。F1/F2は`c2`、F3は`param`が持つ */
export function soundIdsOf(
  events: readonly ChartEvent[],
  format: ChartFormat,
): Set<number> {
  return new Set(
    events
      .filter((event) => SOUND_CMDS.has(event.cmd))
      .map((event) => format === "F3" ? event.param : event.c2),
  );
}

/** sound mapへ、旧バンクに無い`sound_id`を目印として足す。1と2はBGMの開始なので足さない */
export function withUnknownSounds(
  map: Readonly<Record<string, number>>,
  soundIds: Iterable<number>,
): Record<string, number> {
  const unknown = [...soundIds].filter((id) =>
    !BGM_SOUND_IDS.has(id) && !(String(id) in map)
  );
  return {
    ...map,
    ...Object.fromEntries(unknown.map((id) => [String(id), UNKNOWN_SOUND_ID])),
  };
}

const isUnknown = (event: { cmd: number; param: number }) =>
  SOUND_CMDS.has(event.cmd) && event.param === UNKNOWN_SOUND_ID;

/**
 * F3の平文譜面の目印を解く。自動再生音はイベントごと取り除き、キー音割当は無音の埋草へ向ける。
 * 割当を取り除くと、鍵盤に前の音が残るため。目印が無ければ引数をそのまま返す
 */
export function resolveUnknownSounds(chart: Uint8Array): Uint8Array {
  const { events, header } = readF3(chart);
  if (!events.some(isUnknown)) {
    return chart;
  }
  const resolved = events
    .filter((event) => !(isUnknown(event) && event.cmd === AUTO))
    .map((event) =>
      isUnknown(event) ? withParam(event, SILENT_SOUND_ID) : event
    );
  return writeF3({ events: resolved, header });
}
