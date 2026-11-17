// era1の譜面のBGM開始の参照を、PBが曲頭で1回だけ受け取る形へ直す。
// 原作は最初の1か2でBGMを始め、後の参照を無視する。
// PBは1だけでBGMを始める。曲の途中で1を受け取ると、BGMを頭から流し直そうとして止まる。
import {
  commandOf,
  decodeChart,
  encodeChart,
  type F3Event,
  parseEvents,
  type RawEvent,
  readF3,
  withParam,
  writeF3,
} from "../format/mod.ts";
import type { ChartFormat } from "@csa/core";

// ノーツのスロット 8 は、us の5鍵盤版の譜面だけが持つフリースクラッチである(ユーザーの説明)。
// CSA では使わないので、ノーツごと取り除く。
const FREE_SCRATCH_SLOT = 8;

const isNote = (cmd: number) => cmd <= 1;

const isFreeScratch = (event: RawEvent) =>
  isNote(commandOf(event)) && event.c1 >> 4 === FREE_SCRATCH_SLOT;

/** フリースクラッチが無い譜面と、途中で切れた譜面は、受け取ったバイト列をそのまま返す */
export function withoutFreeScratch(
  plain: Uint8Array,
  format: ChartFormat,
): Uint8Array {
  const events = parseEvents(plain, format);
  if (
    events === null ||
    !events.some((e) => isNote(e.cmd) && e.p4 === FREE_SCRATCH_SLOT)
  ) {
    return plain;
  }
  const chart = decodeChart(plain, format);
  return encodeChart({
    ...chart,
    events: chart.events.filter((event) => !isFreeScratch(event)),
  });
}

/** 原作がBGMの開始として受け取る`sound_id` */
export const BGM_SOUND_IDS: ReadonlySet<number> = new Set([1, 2]);
/** PBがBGMの開始として受け取る`sound_id` */
const PB_BGM_SOUND_ID = 1;
const AUTO = 7;

const isBgmStart = (event: F3Event) =>
  event.cmd === AUTO && BGM_SOUND_IDS.has(event.param);

/**
 * F3の平文譜面のBGM開始の参照を直す。最初のtickより後の参照を取り除き、
 * 最初のtickに1が無ければ2を1へ書き換える。直すものが無ければ引数をそのまま返す
 */
export function normalizeBgmStart(chart: Uint8Array): Uint8Array {
  const { events, header } = readF3(chart);
  const starts = events.filter(isBgmStart);
  if (starts.length === 0) {
    return chart;
  }
  const firstTick = Math.min(...starts.map((event) => event.tick));
  const firstStarts = starts.filter((event) => event.tick === firstTick);
  const rewrite = firstStarts.some((event) => event.param === PB_BGM_SOUND_ID)
    ? undefined
    : firstStarts[0];
  const kept = events
    .filter((event) => !isBgmStart(event) || event.tick === firstTick)
    .map((event) =>
      event === rewrite ? withParam(event, PB_BGM_SOUND_ID) : event
    );
  if (rewrite === undefined && kept.length === events.length) {
    return chart;
  }
  return writeF3({ events: kept, header });
}
