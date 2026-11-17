// era1の平文譜面1つを、PBへ入れられるF3の譜面へ変換する。
// sound mapには旧バンクに無い`sound_id`の目印を足し、出力で解いて鳴らさない形にする。
// その後、BGM開始の参照を、PBが曲頭で1回だけ受け取る形へ直す。
import type { ChartFormat } from "@csa/core";
import {
  normalizeBgmStart,
  resolveUnknownSounds,
  soundIdsOf,
  withUnknownSounds,
} from "../fix/mod.ts";
import {
  type Chart,
  decodeChart,
  encodeChart,
  parseEvents,
} from "../format/mod.ts";
import { insertTimesig } from "./timesig.ts";
import { carriesSoundId, rescaleMultiplier, toF3 } from "./widen.ts";

// キー音バンクを振り直したとき、譜面のsound_idも同じ写像で書き換える。
/** 旧`sound_id`(10進文字列) → 新`entry_id` */
export type SoundMap = Readonly<Record<string, number>>;

/**
 * sound_idを運ぶコマンドのparamを、対応表で書き換える。F3の譜面が対象。
 * 表に無い値(era1の1と2はバンクに実体が無いエンジン予約値)はそのまま残す。
 */
export function remapSoundIds(chart: Chart, map: SoundMap): Chart {
  const events = chart.events.map((event) => {
    if (!carriesSoundId(event.c1)) {
      return event;
    }
    const mapped = Object.hasOwn(map, String(event.param))
      ? map[String(event.param)]
      : null;
    if (mapped == null) {
      return event;
    }
    if (mapped > 0xffff) {
      throw new Error(`mapped sound_id ${mapped} does not fit in u16`);
    }
    return { ...event, param: mapped };
  });
  return { ...chart, events };
}

/** PB(15th以降)のmultiplier。全曲で固定 */
export const PB_MULTIPLIER = 0x412b;

/**
 * 拍子の復元は再スケールの前に行う。再スケールはtickを個別に丸めるので、
 * 先に通すと小節長が±1ずれて拍数の判定が鈍る。
 */
export function era1ToPb(chart: Chart): Chart {
  return rescaleMultiplier(insertTimesig(toF3(chart)), PB_MULTIPLIER);
}

export function convertEra1Chart(
  plain: Uint8Array,
  format: ChartFormat,
  soundMap: SoundMap | null,
): Uint8Array {
  const converted = era1ToPb(decodeChart(plain, format));
  return encodeChart(
    soundMap == null ? converted : remapSoundIds(converted, soundMap),
  );
}

/** イベント列が途中で切れた譜面は変換できないので、nullを返す */
export function convertEra1ChartFile(
  plain: Uint8Array,
  format: ChartFormat,
  soundMap: Readonly<Record<string, number>>,
): Uint8Array | null {
  const events = parseEvents(plain, format);
  if (events === null) {
    return null;
  }
  // 足すのは旧バンクに無い値の目印だけ
  const withUnknown = withUnknownSounds(soundMap, soundIdsOf(events, format));
  const chart = convertEra1Chart(plain, format, withUnknown);
  return normalizeBgmStart(resolveUnknownSounds(chart));
}
