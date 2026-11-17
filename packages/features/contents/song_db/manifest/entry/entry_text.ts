// 文字列にした曲DBエントリーの欄を読み書きする。

import type { PbEntryFormat } from "../../pb/format/mod.ts";

export const titleOfEntry = (format: PbEntryFormat, entry: string): string =>
  format.recordOf(format.decode(entry)).title.text;

export function withEntryTitle(
  format: PbEntryFormat,
  entry: string,
  title: string,
): string {
  const bytes = format.decode(entry);
  format.recordOf(bytes).title.text = title;
  return format.encode(bytes);
}

/** レベル欄は符号付きの1バイトである */
export const levelOfEntry = (
  format: PbEntryFormat,
  entry: string,
  name: string,
): number => format.decode(entry)[format.levelFieldOffset(name)] << 24 >> 24;

export const videoFlagsOfEntry = (
  format: PbEntryFormat,
  entry: string,
): number => format.recordOf(format.decode(entry)).video.unkPb62 ?? 0;
