// 曲DBの1曲が参照するファイルを、通し番号のファイルの一覧に書き込む。
// 欄の値の読み方は、各世代の曲DBに合わせる。

import type { Context, SongMeta } from "./context.ts";
import { readCharts, readSounds } from "./chart.ts";
import { readOverlay, readVideos } from "./video.ts";
import type { LevelSource, SongmapRecord, TitlePlan } from "../types.ts";

/** `<表示順> <内部番号>_<曲名>`の前置き */
const INDEX_PREFIX = /^\p{Nd}+ \p{Nd}+_/u;

const stripNul = (text: string) => text.replace(/^\0+|\0+$/g, "");

/** Pythonのshift-jisは0x8160を波ダッシュ(U+301C)に読む。TextDecoderは全角チルダ(U+FF5E)に読むので、抽出済みのsongmapに揃える */
const fromWhatwgShiftJis = (text: string) => text.replaceAll("～", "〜");

/** 埋め込みの枠は、NULを落としてから空白を落とす。前置きは、その後に落とす */
function embeddedTitle(
  record: SongmapRecord,
  plan: Extract<TitlePlan, { source: "embedded" }>,
): string {
  const decoded = plan.encoding === "shift-jis"
    ? fromWhatwgShiftJis(record.title.embeddedIn(plan.encoding))
    : record.title.embeddedIn(plan.encoding);
  const stripped = stripNul(decoded).trim();
  return plan.indexPrefix ? stripped.replace(INDEX_PREFIX, "") : stripped;
}

export function titleOf(
  songId: number,
  record: SongmapRecord,
  plan: TitlePlan,
): string {
  const text = plan.source === "pointer"
    ? record.title.text.trim()
    : plan.source === "full"
    ? record.title.fullIn(plan.encoding) ?? ""
    : embeddedTitle(record, plan);
  return text === "" ? String(songId) : text;
}

export type { Context, SlotNames, SongMeta } from "./context.ts";

/**
 * 0のレベルはnullにする。BEGINNER専用の欄だけは、0でも1要素の配列にする。
 * プラグインがこの欄を`struct.unpack`の戻り値(1要素のタプル)のまま持つため、0との比較が常に偽になる
 */
function levelOf(record: SongmapRecord, source: LevelSource) {
  if (source === "beginner") {
    return [record.selection.beginnerLevel ?? 0];
  }
  return (record.selection.levels.at(source) ?? 0) || null;
}

function metaOf(
  songId: number,
  record: SongmapRecord,
  { rule }: Context,
): SongMeta {
  const charts = Object.entries(rule.levelIndexOf).map(([slot, source]) => {
    const names = {
      chart: null,
      sounds: null,
      bgm: null,
      level: levelOf(record, source),
    };
    return [slot, names] as const;
  });
  return {
    songId,
    title: titleOf(songId, record, rule.title),
    charts: new Map(charts),
    videos: [],
    overlay: null,
  };
}

export function readSong(
  songId: number,
  record: SongmapRecord,
  ctx: Context,
): SongMeta {
  const meta = metaOf(songId, record, ctx);
  readVideos(record, meta, ctx);
  readOverlay(record, meta, ctx);
  readCharts(record, meta, ctx);
  readSounds(record, meta, ctx);
  return meta;
}
