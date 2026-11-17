// PB形式の曲DBエントリの形。欄の位置は持たず、PBの定義(`ElfDefinition`)の配置から求める。
// PBの定義と譜面の並びは`selection/definitions`にあり、featuresどうしは参照しないので、呼び出し元が渡す。

import { decodeBase64, encodeBase64 } from "@std/encoding/base64";
import type { ElfDefinition, SongDbRecordLayout } from "@csa/core";
import { SongDbRecord } from "../../record/mod.ts";
import {
  bgmSlotOf,
  type DifficultyName,
  difficultyOf,
  keysoundSlotOf,
} from "./difficulties.ts";

/** ムービーを外した曲が使う共有BGA。PBの曲index 44が指している */
export const FALLBACK_VIDEO_ABC_INDEX = 900;

/** 譜面の欄はu32、音の欄はu16である */
const CHART_FIELD_BYTES = 4;
const SOUND_FIELD_BYTES = 2;
const NOTES_FIELD_BYTES = 2;
/** 全国平均の欄の数。SP・DP × NORMAL・HYPER・ANOTHER */
const AVERAGE_FIELDS = 6;

type Range = [number, number];

function required<T>(value: T | null, name: string): T {
  if (value == null) {
    throw new Error(`PBの定義に${name}が無い`);
  }
  return value;
}

export class PbEntryFormat {
  /** `chartSlots`は譜面の並び。`sp_hyper`の形の難易度名で持つ */
  constructor(
    readonly definition: ElfDefinition,
    private readonly chartSlots: readonly string[],
  ) {}

  get size(): number {
    return this.definition.songDbRecordLength;
  }

  private get layout(): SongDbRecordLayout {
    return this.definition.songDbRecordLayout;
  }

  /** エントリをコピーせずに包み、定義の配置で読み書きする */
  recordOf(entry: Uint8Array): SongDbRecord {
    return new SongDbRecord(entry, this.definition, null);
  }

  /** 譜面の並びの何番目か */
  chartSlotOf(name: string): number {
    const slot = this.chartSlots.indexOf(name);
    if (slot < 0) {
      throw new Error(`譜面の並びに無い難易度: ${name}`);
    }
    return slot;
  }

  chartFieldOffset(name: string): number {
    return this.chartSlotFieldOffset(this.chartSlotOf(name));
  }

  /** 譜面の有無によらず、全難易度のレベル欄を難易度名で引けるようにする。キーは譜面の欄の順に並べる */
  levelsOf(record: SongDbRecord): Record<string, number> {
    const levels = record.selection.levels;
    return Object.fromEntries(
      this.chartSlots.map((
        name,
      ) => [name, levels[difficultyOf(name).levelIndex]]),
    );
  }

  /** 全難易度のノーツ数欄を難易度名で引けるようにする。DPは1Pと2Pの合計 */
  noteCountsOf(record: SongDbRecord): Record<string, number> {
    const notes = record.chart.notes ?? [];
    return Object.fromEntries(
      this.chartSlots.map((name) => [
        name,
        difficultyOf(name).notesIndices.reduce(
          (sum, index) => sum + (notes[index] ?? 0),
          0,
        ),
      ]),
    );
  }

  /** 難易度のレベル欄(u8)の位置 */
  levelFieldOffset(name: string): number {
    return this.layout.selection.levels.offset + difficultyOf(name).levelIndex;
  }

  /** 難易度のノーツ数欄(u16)の位置。SPは1つ、DPは1Pと2Pの2つ */
  notesFieldOffsets(name: string): number[] {
    const notes = required(this.layout.chart.notes, "notes");
    return difficultyOf(name).notesIndices.map((index) =>
      notes.offset + index * NOTES_FIELD_BYTES
    );
  }

  /** 譜面の並びの`slot`番目の欄の位置 */
  chartSlotFieldOffset(slot: number): number {
    return this.layout.chart.files.offset + slot * CHART_FIELD_BYTES;
  }

  /** 音の並びの`slot`番目の欄の位置 */
  soundFieldOffset(slot: number): number {
    return this.layout.chart.sounds.offset + slot * SOUND_FIELD_BYTES;
  }

  /** 譜面の欄の位置から譜面の並びの番号を引く。`chartFieldOffset`の逆 */
  chartSlotOfField(fieldOffset: number): number {
    return (fieldOffset - this.layout.chart.files.offset) / CHART_FIELD_BYTES;
  }

  /** 譜面の欄の位置から難易度名を引く */
  difficultyNameOfChartField(fieldOffset: number): DifficultyName {
    const name = this.chartSlots.at(this.chartSlotOfField(fieldOffset));
    if (name === undefined) {
      throw new Error(`譜面欄でないoffset: 0x${fieldOffset.toString(16)}`);
    }
    return difficultyOf(name).name;
  }

  keysoundFieldOffset(pair: string): number {
    return this.soundFieldOffset(keysoundSlotOf(this.chartSlotOf(pair)));
  }

  bgmFieldOffset(pair: string): number {
    return this.soundFieldOffset(bgmSlotOf(this.chartSlotOf(pair)));
  }

  /** `index`本目のムービーの欄の位置 */
  videoFieldOffset(index = 0): number {
    const { primary } = this.layout.video;
    return primary.offset + index * primary.bytes;
  }

  /**
   * 曲DBへ書く範囲。
   * エントリを写す世代は、曲中オーバーレイの欄だけを写さない。
   * 曲名カードと画像セットの欄は、写した後で、ISOの配置を決める処理が新しいindexへ置き換える。
   * 合成する世代は、曲名カードと画像セットの欄を書かない。
   * ただし、演奏画面バッファの大きさを選ぶ`+0xBD`の1バイトは書く。ゲームはこの1バイトを読む(`FUN_001debf0`)。
   * 書かない欄は、クローン元の値のままになる。
   * `unkPb126`の先頭6欄は全国平均で、合成する世代は値を持たないので0を書く。
   * 7欄目は意味が分からないので書かない。
   */
  entryRangesOf(copied: boolean): Range[] {
    const overlay = required(this.layout.overlay.packages, "overlay.packages");
    const titleCard = this.layout.artwork.titleCard.offset;
    const playBuffer =
      required(this.layout.artwork.unkPbBcOffset, "unkPbBcOffset") + 1;
    const charts = this.layout.chart.files.offset;
    const notes = required(this.layout.chart.notes, "notes").offset;
    const average = required(this.layout.chart.unkPb126, "unkPb126").offset;
    return copied
      ? [[0, overlay.offset], [titleCard, charts], [charts, notes], [
        notes,
        this.size,
      ]]
      : [[0, overlay.offset], [playBuffer, playBuffer + 1], [charts, notes], [
        notes,
        average + AVERAGE_FIELDS * 2,
      ]];
  }

  /** 収録内容はJSONを経由するので、エントリはbase64で持つ */
  encode(entry: Uint8Array): string {
    if (entry.length !== this.size) {
      throw new Error(`曲DBエントリが${entry.length}バイト`);
    }
    return encodeBase64(entry);
  }

  decode(text: string): Uint8Array {
    const entry = decodeBase64(text);
    if (entry.length !== this.size) {
      throw new Error(`収録内容の曲DBエントリが${entry.length}バイト`);
    }
    return entry;
  }
}
