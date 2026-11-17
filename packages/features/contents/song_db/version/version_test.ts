// 作品番号(バージョン)を決め・変換する規則(folders.ts・new_old_mark.ts)を、
// 原盤を読まずに確かめる。
import { PB_FORMAT } from "../pb/mod.ts";
import {
  folderShort,
  versionByteOf,
  versionFolder,
  versionOfFolderName,
} from "./folders.ts";
import {
  markedVersion,
  newOldLabel,
  unmarkedVersion,
} from "./source_version.ts";
import { generationNumber } from "./source_version.ts";

function assertEquals<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: ${String(actual)} != ${String(expected)}`);
  }
}

Deno.test("選曲フォルダーの枠と作品番号が往復する", () => {
  for (const version of [0, 1, 2, 17]) {
    const name = folderShort(versionFolder(version));
    assertEquals(versionOfFolderName(name), version, `作品番号${version}`);
  }
});

Deno.test("枠外の作品番号は略号?になり、逆引きは例外", () => {
  assertEquals(folderShort(versionFolder(999)), "?", "枠外の略号");
  let threw = false;
  try {
    versionOfFolderName("nope");
  } catch {
    threw = true;
  }
  assertEquals(threw, true, "未知の略号は例外");
});

Deno.test("versionByteOfは作品番号の下位1バイトを読む", () => {
  const record = PB_FORMAT.recordOf(new Uint8Array(PB_FORMAT.size));
  record.selection.origin = 0x107;
  assertEquals(versionByteOf(record), 7, "下位1バイト");
});

Deno.test("新旧の印から作品番号が決まる", () => {
  assertEquals(markedVersion("7th", 0), undefined, "旧曲は決まらない");
  assertEquals(markedVersion("7th", 1), generationNumber("7th"), "新曲");
  assertEquals(markedVersion("7th", 2), generationNumber("7th"), "CS新曲");
  assertEquals(
    markedVersion("3rd", 2),
    versionOfFolderName("1st"),
    "3rdのCSは1st styleの曲",
  );
});

Deno.test("印が無い曲の作品番号は、世代の番号の1つ前にする", () => {
  assertEquals(
    unmarkedVersion("7th", undefined),
    generationNumber("7th"),
    "他世代と同じ管理名で決まった曲",
  );
  assertEquals(
    unmarkedVersion("7th", 0),
    generationNumber("7th") - 1,
    "旧曲の印だけがある曲",
  );
});

Deno.test("原作フォルダー欄の印表記", () => {
  assertEquals(newOldLabel("7th", 0), "旧", "7th 旧");
  assertEquals(newOldLabel("7th", 1), "新", "7th 新");
  assertEquals(newOldLabel("7th", 2), "CS", "7th CS");
  assertEquals(newOldLabel("3rd", 0), "旧", "3rd 旧");
  assertEquals(newOldLabel("3rd", 2), "1st", "3rdのCSは1st style");
});
