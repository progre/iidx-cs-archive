import type { TitleEncoding } from "@csa/core";

export interface SongmapRecord {
  readonly title: {
    /** 曲DBの題名の欄。ELFの別の場所を指す世代では、指す先の文字列である */
    readonly text: string;
    fullIn(encoding: TitleEncoding): string | null;
    /** 前後の空白を落とす前の文字列を返す */
    embeddedIn(encoding: TitleEncoding): string;
  };
  readonly selection: {
    readonly levels: readonly number[];
    readonly beginnerLevel: number | null;
    readonly origin: number | null;
  };
  readonly video: {
    readonly primary: readonly number[];
    readonly secondary: readonly number[] | null;
    readonly secondaryArchive: number | null;
  };
  readonly chart: {
    readonly files: readonly number[];
    readonly sounds: readonly number[];
    /** ANOTHER専用のBGM。フィールドが無い世代ではnull */
    readonly anotherBgm: number | null;
  };
  readonly overlay: { readonly file: number | null };
}

export type VideoPlan =
  | "derived" // 1本目の続き番号を2本目とする
  | "secondaryThenPrimary" // 2本目の欄、1本目の欄の順に読む
  | "primary"
  | "mainThenPrimary" // 2本目の欄に曲全体のムービーがあるので、2本目の欄から先に読む
  | "firstWithTwin"; // 2本目が同じファイルなら、1本目を2本目の番号で名付ける。違うファイルなら両方を読む

/**
 * `pointer`は、曲DBの題名の欄が指す文字列を使う。全曲リストの管理名の照合と同じ欄である。
 * embeddedのindexPrefixは、`<表示順> <内部番号>_`の前置きを落とす
 */
export type TitlePlan =
  | { readonly source: "pointer" }
  | { readonly source: "full"; readonly encoding: TitleEncoding }
  | {
    readonly source: "embedded";
    readonly encoding: TitleEncoding;
    readonly indexPrefix: boolean;
  };

export type SoundPlan =
  | "paired" // 値のある組を、その組の難易度として読む
  | "perChart"; // 譜面のある枠ごとに、その枠の組を読む。空の組は先頭の組を使う

/** beginnerは、曲DBの専用の欄を1要素の配列で持つ */
export type LevelSource = number | "beginner";

export interface SongmapRule {
  /** 通し番号を振るときに、アーカイブをつなぐ順番。7th なら B・C・A の順で `[1, 2, 0]` */
  readonly archiveOrder: readonly number[];
  readonly archiveNames?: "lowercase";
  readonly videoPlan: VideoPlan;
  /** 難易度の枠ごとに、曲DBのどの欄からレベルを読むか */
  readonly levelIndexOf: Readonly<Record<string, LevelSource>>;
  readonly title: TitlePlan;
  /** nullなら、譜面のファイル番号が通し番号である。ELF内の譜面を持つ世代では使わない */
  readonly chartArchive: number | null;
  /** 譜面の欄とキー音・BGMの組の並び。`sp_hyper`の形の難易度名で持つ */
  readonly chartSlots: readonly string[];
  readonly soundPlan: SoundPlan;
}
