import { assertEquals } from "@std/assert";
import type { SongRow } from "../types.ts";
import { saveOrderRows } from "./page.ts";

const song = (
  title: string,
  songId: number,
  extra: Partial<SongRow> = {},
) => ({ generation: "g1", removed: false, songId, title, ...extra }) as SongRow;

const order = (songs: SongRow[]) =>
  saveOrderRows(songs).map((row) => row.title + "/" + row.kind).join(",");

const variantFor = {
  front: "F",
  frontGeneration: "g2",
  frontIndex: 0,
  frontSongId: 0,
  rule: "custom",
};

Deno.test("記録の枠を持つ曲を、曲indexの順に並べる", () => {
  assertEquals(
    order([song("b", 2, { saveIndex: 1 }), song("a", 1, { saveIndex: 0 })]),
    "a/listed,b/listed",
  );
});

Deno.test("外した曲と裏エントリーは、同じ原作のsong_idの並びの位置に入れる", () => {
  assertEquals(
    order([
      song("a", 2, { saveIndex: 0 }),
      song("c", 5, { saveIndex: 1 }),
      song("x0", 1, { removed: true }),
      song("v3", 3, { variantFor }),
      song("other", 1, { generation: "g2", removed: true }),
    ]),
    "x0/removed,a/listed,v3/variant,c/listed,other/removed",
  );
});

Deno.test("PBの曲の記録の枠は、表が別の版でもPBの曲の行に出す", () => {
  assertEquals(
    order([
      song("pb86", 86, { generation: "pb", saveIndex: 86 }),
      song("pb87", 87, { generation: "pb", variantFor }),
      song("g1a", 1, { saveIndex: 99 }),
      song("g1b", 2, { saveIndex: 87 }),
    ]),
    "pb86/listed,pb87/listed,g1a/listed,g1b/variant",
  );
});

Deno.test("同じ曲の行は1つにまとめ、記録の枠を持つ行を残す", () => {
  assertEquals(
    order([
      song("v", 1, { variantFor }),
      song("v", 1, { variantFor, saveIndex: 0 }),
      song("v", 1, { variantFor }),
    ]),
    "v/listed",
  );
});
