// 実行: CSA_PB_ELF=<原盤のELF> deno test --allow-read --allow-env=CSA_PB_ELF packages
// 曲indexを符号なしで読む書き換えが、旧生成器の出力と一致した時点の結果のままであることを見る。

import { assertPatchDigest, testWithPbElf } from "../testing.ts";
import {
  buildSongIndexLbuPatches,
  buildSongIndexSext32Patches,
} from "./mod.ts";

testWithPbElf("曲index配列を読むlbのlbu化", (elf) => {
  assertPatchDigest(
    buildSongIndexLbuPatches(elf),
    "888c9a71db3864e53507d497c3d20252dc36c654dbfe46608cff54645dcc3264",
    "song_index lbu",
  );
});

testWithPbElf("8bit符号拡張のdsrl32化", (elf) => {
  assertPatchDigest(
    buildSongIndexSext32Patches(elf),
    "541eab071d0cb88c00fe35eb17f0295a39ab25132a468bc1456c1fa7d5c17208",
    "song_index dsrl32",
  );
});
