// 3rd〜goldの1曲から、PBの曲DBエントリと資産の参照欄を合成する。
// 素材の曲DBのレコードと譜面の統計は、呼び出し元が読んで渡す。
// 作品番号は全世代の収録を見て決まるので、ここでは書かない。呼び出し元が`writeEntryVersion`で書く。

import type { ChartStats, SongmapSong } from "@csa/core";
import { difficultyOf, type PbEntryFormat } from "../pb/format/mod.ts";
import { FLAG_VIDEO_480 } from "../pb/mod.ts";
import { writeChartFields } from "./chart_fields.ts";
import { hasNameFolderInitial, pbTitleOf } from "./title.ts";

export interface FieldReference {
  fieldOffset: number;
  width: "u16" | "u32";
}

/**
 * 曲に採用したムービーの1本。
 * 大きいバッファーが要るかの判定(`video/buffer_fit.ts`)は、呼び出し元が済ませて渡す。
 */
export interface AdoptedVideo {
  needsLargeBuffer: boolean;
  sourceFileIndex: number;
}

/** 素材世代の曲DBのレコードのうち、合成が読む欄。素材に欄が無ければnull。曲DBのレコードはこの形を満たす */
export interface SourceSongRecord {
  readonly selection: { readonly others: number | null };
  readonly title: { readonly text: string };
  readonly video: {
    readonly movieCountIn: number | null;
    readonly movieLead: number | null;
    readonly unkPb62: number | null;
  };
}

export interface SynthesisInput {
  /** 世代の題名欄の先頭に、`<表示順> <内部番号>_`の前置きが付くか */
  hasIndexPrefix: boolean;
  record: SourceSongRecord;
  /** 素材世代の譜面の統計(file index → 統計) */
  statsOf: (fileIndex: number) => ChartStats;
  song: SongmapSong;
  /**
   * 何本目かの順に並べる。i本目は、曲DBのムービーのi番目のフィールドから参照させる。
   * PBは、ANOTHERなどでBGMが変わると2本目を流す(`0x1DEE40`)。
   * 大きいバッファーの印は曲に1つなので、どの本も同じ判定でなければならない。この条件は、呼び出し元が守る
   */
  videos: readonly AdoptedVideo[];
}

export interface SynthesizedEntry {
  entry: Uint8Array;
  /** 素材のfile index → 曲DB上でそのfileを参照する欄。ISOの配置を決める処理が、新しいABC indexを書く */
  references: Map<number, FieldReference[]>;
}

/** PBで最も多い値(46/99曲)。どちらの欄も無いUSの暫定値 */
const DEFAULT_SYNC = -2;
/**
 * カウントインの基準値が0の曲は、このsyncを使う。この値はPB原盤99曲の最小でもある。
 * ムービーは、フレームのカウンターがsyncと一致したフレームで始まる。
 * カウンターの初期値は、ロード時間で決まる。
 * syncが-122より小さい曲は、ロードが遅いとカウンターがsyncに一致しない。
 * 一致しないときは、ムービーが出ない。
 * そのため、この値をsyncの下限にする
 */
const SYNC_AT_ZERO_COUNT_IN = -122;

/**
 * ムービーを基準点の何フレーム前に出すか。9th以降の素材には、同じ欄がある。
 * 3rd〜8thの素材には、同じ間隔を譜面の側から測った基準値(カウントインの基準値)がある。
 * その基準値は、符号を反転して移す
 */
function syncOf(video: SourceSongRecord["video"]): number {
  const { movieLead, movieCountIn } = video;
  if (movieLead != null) {
    return movieLead;
  }
  if (movieCountIn == null) {
    return DEFAULT_SYNC;
  }
  return SYNC_AT_ZERO_COUNT_IN - Math.min(0, movieCountIn);
}

const levelOf = (level: number | number[]): number =>
  Array.isArray(level) ? level[0] ?? 0 : level;

export function synthesizeEntry(
  format: PbEntryFormat,
  input: SynthesisInput,
): SynthesizedEntry {
  const { hasIndexPrefix, record: source, song, statsOf, videos } = input;
  const entry = new Uint8Array(format.size);
  const record = format.recordOf(entry);
  const dv = new DataView(entry.buffer);
  const references = new Map<number, FieldReference[]>();
  const refer = (index: number, reference: FieldReference) => {
    references.set(index, [...(references.get(index) ?? []), reference]);
    // ISOの配置を決める処理が新しいABC indexを書くまでの仮の値。未使用スロットの0xFFFFと区別する
    if (reference.width === "u16") dv.setUint16(reference.fieldOffset, 0, true);
    else dv.setUint32(reference.fieldOffset, 0, true);
  };
  // 音声スロットは使わない組を0xFFFFにする(PB実測)。0はfile index 0として読まれる
  record.chart.sounds = record.chart.sounds.map(() => 0xffff);

  record.title.text = pbTitleOf(source.title.text, hasIndexPrefix);
  // 3rd〜8thの素材には、OTHERSの印が無い。印が無いと、頭文字フォルダーに入らない曲が
  // どこにも出ない。そのため、書いたばかりの題名の頭文字から印の値を決める
  record.selection.others = source.selection.others ??
    (hasNameFolderInitial(record) ? 0 : 1);
  record.video.movieLead = syncOf(source.video);
  const flags = source.video.unkPb62 ?? 0;
  record.video.unkPb62 = flags |
    (videos.at(0)?.needsLargeBuffer ? FLAG_VIDEO_480 : 0);
  videos.forEach((video, slot) =>
    refer(video.sourceFileIndex, {
      fieldOffset: format.videoFieldOffset(slot),
      width: "u32",
    })
  );

  const levels = record.selection.levels;
  for (const [name, chart] of Object.entries(song.charts)) {
    levels[difficultyOf(name).levelIndex] = levelOf(chart.level);
    refer(chart.chart, {
      fieldOffset: format.chartFieldOffset(name),
      width: "u32",
    });
  }
  record.selection.levels = levels;
  writeChartFields(
    record,
    new Map(
      Object.entries(song.charts).map((
        [name, chart],
      ) => [name, statsOf(chart.chart)]),
    ),
  );
  for (const sound of song.sounds) {
    if (sound.keysound !== null) {
      refer(sound.keysound, {
        fieldOffset: format.keysoundFieldOffset(sound.pair),
        width: "u16",
      });
    }
    if (sound.bgm !== null) {
      refer(sound.bgm, {
        fieldOffset: format.bgmFieldOffset(sound.pair),
        width: "u16",
      });
    }
  }
  for (const list of references.values()) {
    list.sort((a, b) => a.fieldOffset - b.fieldOffset);
  }
  return { entry, references };
}
