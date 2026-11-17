// 曲DBエントリの合成が書く欄を、組み立てた値で確かめる。原盤は読まない。
import { assertEquals } from "@std/assert";
import { difficultyOf } from "../pb/format/mod.ts";
import {
  FLAG_VIDEO_480,
  PB_DEFINITION,
  PB_FORMAT,
  writeEntryVersion,
} from "../pb/mod.ts";
import { synthesizeEntry } from "./synthesize.ts";
import { SONG, STATS } from "./testing.ts";

const { selection, title, video } = PB_DEFINITION.songDbRecordLayout;
const TITLE = title.offset;
const OTHERS = selection.others!.offset;
const VERSION = selection.origin!.offset;
const SYNC = video.movieLeadOffset!;
const FLAGS = video.unkPb62Offset!;
const VIDEO = video.primary.offset;

/** 曲DBのレコードの欄。テストで書きやすいように、入れ子をやめて1階層に並べた */
interface Fields {
  movieCountIn: number | null;
  movieLead: number | null;
  others: number | null;
  text: string;
  unkPb62: number | null;
}

const FIELDS: Fields = {
  movieCountIn: null,
  movieLead: null,
  others: null,
  text: "abc",
  unkPb62: null,
};

const synthesize = (
  fields: Partial<Fields> = {},
  extra: { needsLargeBuffer?: boolean } = {},
) => {
  const { movieCountIn, movieLead, others, text, unkPb62 } = {
    ...FIELDS,
    ...fields,
  };
  return synthesizeEntry(PB_FORMAT, {
    hasIndexPrefix: false,
    record: {
      selection: { others },
      title: { text },
      video: { movieCountIn, movieLead, unkPb62 },
    },
    song: SONG,
    statsOf: () => STATS,
    videos: extra.needsLargeBuffer === undefined ? [] : [{
      needsLargeBuffer: extra.needsLargeBuffer,
      sourceFileIndex: 9,
    }],
  });
};

const viewOf = (entry: Uint8Array) => new DataView(entry.buffer);

Deno.test("題名は大文字で書き、レベルを書く。作品番号は書かない", () => {
  const { entry } = synthesize();
  assertEquals(String.fromCharCode(...entry.subarray(TITLE, 3)), "ABC");
  const levels = PB_FORMAT.recordOf(entry).selection.levels;
  assertEquals(levels[difficultyOf("sp_normal").levelIndex], 5);
  assertEquals(viewOf(entry).getUint16(VERSION, true), 0);
});

Deno.test("作品番号を後から書いても、参照欄と他の欄は変わらない", () => {
  const { entry, references } = synthesize({}, { needsLargeBuffer: false });
  const withVersion = (version: number) => {
    const copy = entry.slice();
    writeEntryVersion(PB_FORMAT, copy, version);
    return copy;
  };
  const [a, b] = [withVersion(4), withVersion(9)];
  assertEquals(
    [...a].flatMap((byte, at) => byte === b[at] ? [] : [at]),
    [VERSION],
  );
  assertEquals(viewOf(a).getUint16(VERSION, true), 4);
  assertEquals(viewOf(b).getUint16(VERSION, true), 9);
  assertEquals(
    [...references.keys()].sort((x, y) => x - y),
    [3, 7, 9],
  );
});

Deno.test("素材にOTHERS印が無ければ題名の頭文字から決める", () => {
  assertEquals(viewOf(synthesize().entry).getUint16(OTHERS, true), 0);
  const digit = synthesize({ text: "1abc" }).entry;
  assertEquals(viewOf(digit).getUint16(OTHERS, true), 1);
  const marked = synthesize({ text: "1abc", others: 0 }).entry;
  assertEquals(viewOf(marked).getUint16(OTHERS, true), 0);
});

Deno.test("syncは素材の欄、カウントインの反転、既定値の順に決める", () => {
  const sync = (fields: Partial<Fields>) =>
    viewOf(synthesize(fields).entry).getInt16(SYNC, true);
  assertEquals(sync({ movieLead: -30 }), -30);
  assertEquals(sync({ movieCountIn: -10 }), -112);
  assertEquals(sync({ movieCountIn: 5 }), -122);
  assertEquals(sync({}), -2);
});

Deno.test("大きいバッファーが要るムービーはフラグを立てて参照欄を作る", () => {
  const { entry, references } = synthesize({ unkPb62: 1 }, {
    needsLargeBuffer: true,
  });
  assertEquals(entry[FLAGS], 1 | FLAG_VIDEO_480);
  assertEquals(references.get(9), [{ fieldOffset: VIDEO, width: "u32" }]);
});
