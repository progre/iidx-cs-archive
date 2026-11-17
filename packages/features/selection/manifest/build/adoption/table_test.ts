// 差し替え表の曲の名前を、世代とsong_idに変換する。
// 実行: deno test packages/features/selection/manifest/build/adoption/table_test.ts

import { assertEquals, assertThrows } from "@std/assert";
import type { IndexDoc } from "../../index/mod.ts";
import { videoAdoptionsOf } from "./table.ts";

const index = {
  songs: {
    ALPHA: { generations: { dd: [{ song_id: 4 }], pb: [{ song_id: 9 }] } },
    BETA: { generations: { dd: [{ song_id: 5 }, { song_id: 6 }] } },
  },
} as unknown as IndexDoc;

const HEADER = "song,slot,adopt,adopt_slot,alias\n";

Deno.test("管理名を世代とsong_idに変換し、何本目かを読む", () => {
  assertEquals(
    videoAdoptionsOf(HEADER + "dd:ALPHA,1,pb:ALPHA,1,\n", index),
    [{
      song: { generation: "dd", songId: 4 },
      slot: 1,
      adopt: { generation: "pb", songId: 9 },
      adoptSlot: 1,
    }],
  );
});

Deno.test("#の後ろのsong_idと、世代:song_idの管理名を読む", () => {
  assertEquals(
    videoAdoptionsOf(HEADER + "dd:BETA#6,0,dd:dd:12,,\n", index),
    [{
      song: { generation: "dd", songId: 6 },
      slot: 0,
      adopt: { generation: "dd", songId: 12 },
      adoptSlot: 0,
    }],
  );
});

Deno.test("aliasを書いた行は、採用元の曲の代わりに別名を持つ", () => {
  assertEquals(
    videoAdoptionsOf(HEADER + "dd:ALPHA,0,,,7th_techno\n", index),
    [{ song: { generation: "dd", songId: 4 }, slot: 0, alias: "7th_techno" }],
  );
});

Deno.test("adoptとaliasを両方書いた行は止まる", () => {
  assertThrows(
    () => videoAdoptionsOf(HEADER + "dd:ALPHA,0,pb:ALPHA,0,a\n", index),
    Error,
    "adoptとaliasのどちらか一方",
  );
});

Deno.test("adoptもaliasも無い行は止まる", () => {
  assertThrows(
    () => videoAdoptionsOf(HEADER + "dd:ALPHA,0,,,\n", index),
    Error,
    "adoptとaliasのどちらか一方",
  );
});

Deno.test("同じ管理名の曲が複数あって#が無ければ止まる", () => {
  assertThrows(
    () => videoAdoptionsOf(HEADER + "dd:BETA,0,pb:ALPHA,0,\n", index),
    Error,
    "1つに決まらない",
  );
});

Deno.test("索引に無い管理名は止まる", () => {
  assertThrows(
    () => videoAdoptionsOf(HEADER + "dd:GAMMA,0,pb:ALPHA,0,\n", index),
    Error,
    "索引に無い",
  );
});
