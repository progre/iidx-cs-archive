// PBの曲の音について、本体とヘッダーのハッシュをPBの原盤から求める。
// 世代の音のハッシュは周回で求めてあるので、PBの分を足して曲リストへ渡す。

import {
  discOffsetOf,
  inDiscOrder,
  inKeyOrder,
  SEC,
  type SongmapDoc,
  type SoundPrint,
} from "@csa/core";
import type { LapMeasurePorts } from "../../ports.ts";
import type { PbDisc } from "../lap/mod.ts";

export async function withPbSoundPrints(
  ports: Pick<LapMeasurePorts, "soundPrint">,
  generationPrints: ReadonlyMap<string, SoundPrint>,
  pbSongmap: SongmapDoc,
  pbDisc: PbDisc,
): Promise<Map<string, SoundPrint>> {
  const prints = new Map(generationPrints);
  const fileOf = new Map(pbSongmap.files.map((file) => [file.index, file]));
  const sounds = pbSongmap.songs
    .flatMap((song) => song.sounds)
    .flatMap((pair) => [
      ["keysound", pair.keysound] as const,
      ["bgm", pair.bgm] as const,
    ]);
  const targets = sounds.flatMap(([kind, index]) => {
    if (index === null || prints.has(`pb:${index}`)) {
      return [];
    }
    const file = fileOf.get(index);
    if (file === undefined) {
      throw new Error(`PBのファイル一覧にABC index ${index}が無い`);
    }
    return [{ file, index, kind }];
  });
  const inOrder = inDiscOrder(
    targets,
    ({ file }) => discOffsetOf(pbDisc.info.files, file.archive, file.offset),
  );
  for (const { file, index, kind } of inOrder) {
    const source = `pb:${index}`;
    if (prints.has(source)) {
      continue;
    }
    const archive = pbDisc.info.files.get(
      file.archive.toUpperCase().split(";")[0],
    );
    if (archive === undefined) {
      throw new Error(`PBのファイル一覧にABC index ${index}が無い`);
    }
    const bytes = await pbDisc.readAt(
      archive.lba * SEC + file.offset,
      file.size,
    );
    prints.set(source, await ports.soundPrint(kind, bytes));
  }
  // 曲リストは表の並びのまま書くので、読んだ順ではなく元の順に戻す
  return inKeyOrder(prints, [
    ...generationPrints.keys(),
    ...targets.map(({ index }) => `pb:${index}`),
  ]);
}
