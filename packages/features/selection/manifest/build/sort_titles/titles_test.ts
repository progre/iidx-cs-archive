import { assertEquals, assertThrows } from "@std/assert";
import type { IndexTitleOf } from "../../index/mod.ts";
import { songIdOf, sortTitlesOf, type TitledSong } from "./titles.ts";

/** 作品の並び。後の作品ほど後ろにある */
const GENERATIONS = "3rd 4th 5th 6th 7th 8th 9th 10th red hs dd gold djt emp"
  .split(" ");

const sort = (
  songs: readonly TitledSong[],
  pbSongs: readonly TitledSong[],
  indexTitleOf: IndexTitleOf,
) => sortTitlesOf(songs, pbSongs, indexTitleOf, GENERATIONS);

const song = (
  generation: string,
  songId: number,
  key: string,
  title: string,
  extra: Partial<TitledSong> = {},
): TitledSong => ({ generation, key, listed: true, songId, title, ...extra });

/** `世代:song_id` → 全曲リストの`index_title` */
const titlesOf =
  (names: Record<string, string> = {}): IndexTitleOf => (generation, songId) =>
    names[songIdOf(generation, songId)] ?? null;

Deno.test("表は土台の名前、ほかの版は古い順で us を最後にする", () => {
  const titles = sort(
    [
      song("us", 44, "SAMPLESONG", "Sample Song"),
      song("7th", 48, "SAMPLESONG", "Sample Song"),
      song("3rd", 1, "SAMPLESONG", "Sample Song"),
    ],
    [song("pb", 88, "SAMPLESONG", "SAMPLE SONG")],
    titlesOf(),
  );
  assertEquals(titles.get("3rd:1"), "SAMPLE SONG  1");
  assertEquals(titles.get("7th:48"), "SAMPLE SONG  2");
  assertEquals(titles.get("us:44"), "SAMPLE SONG  3");
});

Deno.test("PB の曲が表の版なら、index_title があっても曲DBの題名を土台にする", () => {
  const titles = sort(
    [song("7th", 13, "FM", "FAKE MELODY")],
    [song("pb", 63, "FM", "FAKE MELODIE")],
    titlesOf({ "pb:63": "Fake Melody" }),
  );
  assertEquals(titles.get("7th:13"), "FAKE MELODIE  1");
});

Deno.test("PB が無い組は、新しい世代の版が表になり、表の名前は表から取る", () => {
  const titles = sort(
    [
      song("4th", 12, "MT", "MOCK TUNE(LONG MIX)"),
      song("gold", 72, "MT", "MOCK"),
    ],
    [],
    titlesOf({ "gold:72": "MOCK TUNE (LONG MIX)" }),
  );
  assertEquals(titles.get("gold:72"), "MOCK TUNE (LONG MIX)");
  assertEquals(titles.get("4th:12"), "MOCK TUNE (LONG MIX)  1");
});

Deno.test("editionのある版は、土台の名前の後ろに edition を足す", () => {
  const titles = sort(
    [
      song("10th", 18, "DT", "DEMO TRACK"),
      song("dd", 77, "DT", "DEMO TRACK", { edition: "dd" }),
      song("4th", 12, "MT", "MOCK TUNE(LONG MIX)", { edition: "4th" }),
      song("gold", 72, "MT", "MOCK"),
    ],
    [],
    titlesOf({ "gold:72": "MOCK TUNE (LONG MIX)" }),
  );
  assertEquals(titles.get("10th:18"), undefined);
  assertEquals(titles.get("dd:77"), "DEMO TRACK  DD");
  assertEquals(titles.get("gold:72"), "MOCK TUNE (LONG MIX)");
  assertEquals(titles.get("4th:12"), "MOCK TUNE (LONG MIX)  4TH");
});

Deno.test("裏は書き換えず、5鍵盤版は表と同じ題名にする", () => {
  const titles = sort(
    [
      song("djt", 76, "PLC", "PLC"),
      song("djt", 101, "PLC5", "PLC_5", { fiveKeyOf: "djt:76" }),
      song("djt", 20, "PLC", "PLC", { listed: false }),
    ],
    [],
    titlesOf({ "djt:76": "PLACEHOLDER" }),
  );
  assertEquals(titles.get("djt:101"), "PLACEHOLDER");
  assertEquals(titles.has("djt:20"), false);
});

Deno.test("小文字は大文字へそろえ、枠に入らない題名は止める", () => {
  const titles = sort([song("3rd", 9, "A", "a")], [], titlesOf());
  assertEquals(titles.get("3rd:9"), "A");
  assertThrows(() =>
    sort(
      [song("3rd", 9, "A", "A")],
      [],
      titlesOf({ "3rd:9": "A".repeat(64) }),
    )
  );
  // 曲DBの題名が空の曲でも、題名を変えなければエラーにしない
  assertEquals(
    sort([song("emp", 100, "E", "")], [], titlesOf()).size,
    0,
  );
});
