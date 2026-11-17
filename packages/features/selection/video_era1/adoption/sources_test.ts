import { assertEquals } from "@std/assert";
import { buildEra1Source, videoKeyOf } from "./sources.ts";

const entry = (archive: string, index: number) => ({
  archive,
  index,
  offset: index * 100,
  size: 10,
});

Deno.test("videoKeyOf: 拡張子を除いたアーカイブ名と4桁の行で作る", () => {
  assertEquals(videoKeyOf(entry("movie.bin", 7)), "MOVIE_0007");
});

Deno.test("buildEra1Source: 重複を数え、2本の曲に相方を付ける", () => {
  const source = buildEra1Source("3rd", [
    { entries: [entry("a.bin", 2), entry("a.bin", 1)], id: 0, title: "X" },
    { entries: [entry("a.bin", 1)], id: 1, title: "Y" },
  ]);
  assertEquals(source.songs, [
    { id: 0, videos: ["A_0002", "A_0001"] },
    { id: 1, videos: ["A_0001"] },
  ]);
  assertEquals(source.videos.map((video) => video.key), ["A_0001", "A_0002"]);
  const [row1, row2] = source.videos;
  assertEquals(row1.songCount, 2);
  assertEquals(row1.partner, "A_0002");
  assertEquals(row1.slot, 1);
  assertEquals(row2.partner, "A_0001");
  assertEquals(row2.title, "X");
});
