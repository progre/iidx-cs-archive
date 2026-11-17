// `definitions.csv`を読み、世代ごとの原盤の定義にする。

import { parse } from "@std/csv";
import type {
  ArchiveTable,
  ChartFormat,
  ElfDefinition,
  FileTableDefinition,
  KeysoundForm,
} from "@csa/core";
import {
  booleanOf,
  cellOf,
  numberOf,
  optionalCellOf,
  type Row,
} from "./cells.ts";
import text from "./definitions.csv" with { type: "text" };
import { songDbRecordLayoutOf } from "./layout.ts";

const ARCHIVE_PREFIXES = ["archive1", "archive2", "archive3"];

function archiveOf(row: Row, prefix: string): ArchiveTable | null {
  const fileName = cellOf(row, `${prefix}Name`);
  return fileName === "" ? null : {
    fileName,
    offset: numberOf(row, `${prefix}TableOffset`),
    count: numberOf(row, `${prefix}Count`),
  };
}

export function fileTableOf(row: Row): FileTableDefinition {
  return {
    archives: ARCHIVE_PREFIXES
      .map((prefix) => archiveOf(row, prefix))
      .filter((archive) => archive != null),
    rowBytes: numberOf(row, "fileTableRowBytes"),
    sizeIndex: numberOf(row, "fileTableSizeIndex"),
    sizeUnit: numberOf(row, "fileTableSizeUnit"),
  };
}

export type Generation =
  | "3rd"
  | "4th"
  | "5th"
  | "6th"
  | "7th"
  | "8th"
  | "9th"
  | "10th"
  | "us"
  | "red"
  | "hs"
  | "dd"
  | "gold"
  | "djt"
  | "emp"
  | "pb";

export type Era = "era1" | "era2" | "era3";

export interface Definition {
  generation: Generation;
  /** 確かめていない世代はnull */
  era: Era | null;
  /** 譜面形式は内容から判別できないので、世代で決める */
  chartFormat: ChartFormat;
  /** キー音バンクの形式。eraとは一致しない。確かめていない世代はnull */
  keysoundForm: KeysoundForm | null;
  /** 原作のドライバーが、同じ番号のキー音の鳴らし直しで前の音を止めるか */
  keysoundRetriggerCut: boolean;
  elf: ElfDefinition;
}

function elfOf(row: Row): ElfDefinition {
  const songDbRecordLength = numberOf(row, "songDbRecordLength");
  return {
    fileName: cellOf(row, "fileName"),
    songDbBase: numberOf(row, "songDbBase"),
    songDbRecordCount: numberOf(row, "songDbSize") / songDbRecordLength,
    songDbRecordLength,
    pointerBase: numberOf(row, "elfPointerBase"),
    fileTable: fileTableOf(row),
    songDbRecordLayout: songDbRecordLayoutOf(row),
  };
}

/** 形式の値は検査しない。eraとキー音形式は、使う側が原盤の音と突き合わせる */
const definitionOf = (row: Row): Definition => ({
  generation: cellOf(row, "generation") as Generation,
  era: optionalCellOf(row, "era") as Era | null,
  chartFormat: cellOf(row, "chartFormat") as ChartFormat,
  keysoundForm: optionalCellOf(row, "keysoundForm") as KeysoundForm | null,
  keysoundRetriggerCut: booleanOf(row, "keysoundRetriggerCut"),
  elf: elfOf(row),
});

/**
 * CSVの各行は1つの項目を表し、各列は1つの世代を表す。
 * 読んだ表を世代ごとに分け、項目名をキーにしたオブジェクトにする
 */
function rowsOf(table: string[][]): Row[] {
  const generations = table.at(0)?.slice(1) ?? [];
  return generations.map((_, i) =>
    Object.fromEntries(table.map(([field, ...values]) => [field, values[i]]))
  );
}

/** 列の順は発売順で、PBが最後 */
export const DEFINITIONS: Definition[] = rowsOf(
  parse(text, { trimLeadingSpace: true }),
).map(definitionOf);

/** 世代の定義。定義が無い世代は例外にする */
export function definitionOfGeneration(generation: string): Definition {
  const found = DEFINITIONS.find((def) => def.generation === generation);
  if (found === undefined) {
    throw new Error(`定義が無い世代: ${generation}`);
  }
  return found;
}

/** 世代の実行ファイルの定義。定義が無い世代は例外にする */
export const elfDefinitionOf = (generation: string): ElfDefinition =>
  definitionOfGeneration(generation).elf;

/** 世代の実行ファイル名。原盤のルートに同じ名前で置かれている */
export const elfFileNameOf = (generation: string): string =>
  elfDefinitionOf(generation).fileName;
