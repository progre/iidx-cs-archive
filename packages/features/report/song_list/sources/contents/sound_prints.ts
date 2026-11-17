// PBの曲の音について、本体とヘッダーのハッシュをPBの原盤から求める。
// 世代の音のハッシュは周回で求めてあるので、PBの分を足して曲リストへ渡す。

import { SEC, type SongmapDoc, type SoundPrint } from "@csa/core";
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
  for (const [kind, index] of sounds) {
    const source = `pb:${index}`;
    if (index === null || prints.has(source)) {
      continue;
    }
    const file = fileOf.get(index);
    const archive = file &&
      pbDisc.info.files.get(file.archive.toUpperCase().split(";")[0]);
    if (file === undefined || archive === undefined) {
      throw new Error(`PBのファイル一覧にABC index ${index}が無い`);
    }
    const bytes = await pbDisc.readAt(
      archive.lba * SEC + file.offset,
      file.size,
    );
    prints.set(source, await ports.soundPrint(kind, bytes));
  }
  return prints;
}
