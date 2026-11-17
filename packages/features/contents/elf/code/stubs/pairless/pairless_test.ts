import { buildFakeElf, type MutableElf } from "../../../elf/mod.ts";
import type { PairlessSong, SongContent } from "../../../model/mod.ts";
import { verifyPairless, writePairless } from "./mod.ts";
import {
  DESCRIPTOR_POINTER_ADDR,
  fieldOffset,
  LOADER_SITE,
  MATCH_STUB,
  MATCHER_HEAD,
  PACKAGE_TABLE_ADDR,
  ROW_SIZE,
  TABLE,
} from "./table.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${label}: ${a} != ${b}`);
}

function assertThrows(fn: () => unknown, label: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) throw new Error(`${label}: 例外が出なかった`);
}

const DEFAULT_SONG_INDEX = 4;
const DEFAULT_PACKAGE = 111;
const DEFAULT_DESCRIPTOR = 0x2000;

function fakeContentElf(): MutableElf {
  const elf = buildFakeElf([
    { vaddr: MATCHER_HEAD, size: 0x10 },
    { vaddr: PACKAGE_TABLE_ADDR, size: 4 },
    { vaddr: DESCRIPTOR_POINTER_ADDR, size: 4 },
    { vaddr: LOADER_SITE, size: 0x10 },
    { vaddr: MATCH_STUB, size: 0x800 },
  ]);
  elf.setU32(MATCHER_HEAD, DEFAULT_SONG_INDEX);
  elf.setU32(PACKAGE_TABLE_ADDR, DEFAULT_PACKAGE);
  elf.setU32(DESCRIPTOR_POINTER_ADDR, DEFAULT_DESCRIPTOR);
  return elf;
}

interface Row {
  descriptor: number;
  packageIndex: number;
  songIndex: number;
}

function readTableRows(elf: MutableElf): Row[] {
  const rows: Row[] = [];
  for (let index = 0; index < 8; index++) {
    const at = TABLE + index * ROW_SIZE;
    const songIndex = elf.u32(at + fieldOffset("songIndex")) | 0;
    rows.push({
      descriptor: elf.u32(at + fieldOffset("descriptor")),
      packageIndex: elf.u32(at + fieldOffset("packageIndex")) | 0,
      songIndex,
    });
    if (songIndex === -1) break;
  }
  return rows;
}

/** 判定stubと同じ規則: 終端(-1)に達する前に一致すれば1 */
function matches(songIndex: number, rows: readonly Row[]): boolean {
  for (const row of rows) {
    if (row.songIndex === -1) return false;
    if (row.songIndex === songIndex) return true;
  }
  return false;
}

function song(songIndex: number, packageIndex: number): PairlessSong {
  return {
    descriptor: new Uint8Array(0x140).fill(songIndex & 0xff),
    packageIndex,
    songIndex,
  };
}

Deno.test("pairless: 追加0件は既定の曲DB indexにだけ一致する", () => {
  const elf = fakeContentElf();
  const content: SongContent = { songs: [] };
  writePairless(elf, content);
  verifyPairless(elf, content);
  const rows = readTableRows(elf);
  assertEquals(rows.length, 2, "行数(既定1行+終端)");
  for (const candidate of [-2, 0, 1, 3, 5, 999]) {
    assertEquals(
      matches(candidate, rows),
      false,
      `不一致であるべき: ${candidate}`,
    );
  }
  assertEquals(
    matches(DEFAULT_SONG_INDEX, rows),
    true,
    "既定の曲DB indexに一致",
  );
});

Deno.test("pairless: 追加2件で表が3行と終端になる", () => {
  const elf = fakeContentElf();
  const content: SongContent = {
    pairlessSongs: [song(9, 459), song(2, 452)],
    songs: [],
  };
  writePairless(elf, content);
  verifyPairless(elf, content);
  const rows = readTableRows(elf);
  assertEquals(rows.length, 4, "行数(3行+終端)");
  assertEquals(
    rows.map((row) => row.songIndex),
    [2, DEFAULT_SONG_INDEX, 9, -1],
    "曲DB indexの昇順",
  );
});

Deno.test("pairless: 割り当てを超える件数は例外", () => {
  const elf = fakeContentElf();
  const content: SongContent = {
    pairlessSongs: [
      song(1, 1),
      song(2, 2),
      song(3, 3),
      song(5, 5),
      song(6, 6),
      song(7, 7),
    ],
    songs: [],
  };
  assertThrows(() => writePairless(elf, content), "確保領域超過");
});
