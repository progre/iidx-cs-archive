// 世代のオーバーレイの中身の長さとハッシュを求める。曲リストは、長さを容量として出し、ハッシュで同じ中身かを見分ける。
// 長さは、9th以降は`.if`の記述子が示す長さ、3rd〜8thはファイル表の大きさである。
// 3rd〜8thの`.if`はPBと形が違うので、記述子から長さを求められない。
// ファイル表に書かれた大きさはセクタ単位に丸めた値ではないので、これを長さとして使う。
// 中身が同じファイルは、世代が違っても同じ値になる。bundleに詰めた後の大きさは、世代の変換で変わるので使わない。
// 曲リストは外した曲の行にも容量を表示するので、全曲リストで外した曲のファイルも数える。

import {
  discOffsetOf,
  inDiscOrder,
  inKeyOrder,
  isProgressStep,
  type OpenDisc,
  SEC,
  type SourceSlice,
} from "@csa/core";
import { overlaySourceOf } from "../../data/rows/mod.ts";
import type { LapMeasurePorts } from "../../ports.ts";

type OverlayPorts = Pick<
  LapMeasurePorts,
  "ifPayloadLength" | "isLegacyOverlay" | "printOf"
>;

type Read = (offset: number, length: number) => Promise<Uint8Array>;

/** `overlaySourceOf`の識別子で引く、オーバーレイの長さとハッシュ */
export interface OverlayMeasures {
  lengths: Map<string, number>;
  prints: Map<string, string>;
}

/**
 * ファイルの先頭からの読み取りを、読んだ所の続きだけ原盤から読む形にする。
 * 記述子を読んだ後で中身を読んでも、原盤では手前に戻らない
 */
function forwardReader(read: Read): Read {
  let head = new Uint8Array(0);
  return async (offset, length) => {
    const end = offset + length;
    if (end > head.length) {
      const rest = await read(head.length, end - head.length);
      const grown = new Uint8Array(end);
      grown.set(head);
      grown.set(rest, head.length);
      head = grown;
    }
    return head.subarray(offset, end);
  };
}

/**
 * ハッシュの範囲は、長さまでとする。
 * `.if`の記述子が示す長さが目次の大きさを超える原盤があるので、目次の大きさで抑える
 */
export async function overlayMeasuresOf(
  ports: OverlayPorts,
  { disc, files }: OpenDisc,
  generation: string,
  overlays: readonly SourceSlice[],
): Promise<OverlayMeasures> {
  const lengths = new Map<string, number>();
  const prints = new Map<string, string>();
  const legacy = ports.isLegacyOverlay(generation);
  const inOrder = inDiscOrder(
    overlays,
    (slice) => discOffsetOf(files, slice.sourceArchive, slice.sourceOffset),
  );
  for (const [done, slice] of inOrder.entries()) {
    if (isProgressStep(done + 1, overlays.length)) {
      console.log(`${done + 1}/${overlays.length} ${generation} overlay print`);
    }
    const source = overlaySourceOf(generation, slice.sourceFileIndex);
    if (lengths.has(source)) {
      continue;
    }
    const archiveName = slice.sourceArchive.toUpperCase().split(";")[0];
    const archive = files.get(archiveName);
    if (archive === undefined) {
      throw new Error(`source ISOに${archiveName}が無い`);
    }
    const start = archive.lba * SEC + slice.sourceOffset;
    const read = forwardReader((offset, length) =>
      disc.readAt(start + offset, length)
    );
    const length = legacy
      ? slice.sourceSize
      : await ports.ifPayloadLength(read);
    lengths.set(source, length);
    prints.set(
      source,
      await ports.printOf(await read(0, Math.min(length, slice.sourceSize))),
    );
  }
  // 曲リストは表の並びのまま書くので、読んだ順ではなく元の順に戻す
  const sources = overlays.map((slice) =>
    overlaySourceOf(generation, slice.sourceFileIndex)
  );
  return {
    lengths: inKeyOrder(lengths, sources),
    prints: inKeyOrder(prints, sources),
  };
}
