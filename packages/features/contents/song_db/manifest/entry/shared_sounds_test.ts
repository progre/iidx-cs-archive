// PB原盤の曲と共有する音の欄。ファイルを読まず、組み立てた行とエントリーで確かめる。

import { assertEquals, assertThrows } from "@std/assert";
import { PB_FORMAT as PB_ENTRY } from "../../pb/mod.ts";
import type { SongmapSong, SourceAsset } from "@csa/core";
import { pbSongOf, withPbSounds } from "./shared_sounds.ts";

const sound = (kind: "bgm" | "keysound", pair: string) =>
  ({ fields: [pair], kind }) as SourceAsset;

const row = (assets: SourceAsset[]) => ({
  sourceAssets: assets,
  sourceGeneration: "djt",
  share: "SAMPLESONG",
  sourceSongIndex: 1,
});

const pbSong = {
  song_id: 0,
  sounds: [{ bgm: 786, keysound: 787, pair: "sp_hyper" }],
  title: "SAMPLESONG",
} as unknown as SongmapSong;

Deno.test("shareに書いた管理名で、PBの曲を引く", () => {
  assertEquals(pbSongOf(row([]), [pbSong]).song_id, 0);
  assertThrows(() => pbSongOf(row([]), []), Error, "SAMPLESONGがPBに無い");
});

Deno.test("音の欄に、PBの曲の同じ組のABC indexを書く", () => {
  const text = withPbSounds(
    PB_ENTRY,
    PB_ENTRY.encode(new Uint8Array(PB_ENTRY.size)),
    row([sound("bgm", "sp_hyper"), sound("keysound", "sp_hyper")]),
    pbSong,
  );
  const view = new DataView(PB_ENTRY.decode(text).buffer);
  assertEquals(view.getUint16(PB_ENTRY.bgmFieldOffset("sp_hyper"), true), 786);
  assertEquals(
    view.getUint16(PB_ENTRY.keysoundFieldOffset("sp_hyper"), true),
    787,
  );
});

Deno.test("PBの曲に無い組の音を使っていれば、止まる", () => {
  assertThrows(
    () =>
      withPbSounds(
        PB_ENTRY,
        PB_ENTRY.encode(new Uint8Array(PB_ENTRY.size)),
        row([sound("bgm", "sp_another")]),
        pbSong,
      ),
    Error,
    "sp_anotherのbgmが、PBのSAMPLESONGに無い",
  );
});
