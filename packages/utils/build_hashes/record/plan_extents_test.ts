import { extentsOfPlan } from "./plan_extents.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`,
    );
  }
}

const row = (cells: string[]) => cells.join("\t");

Deno.test("曲の資産・曲名カード・オーバーレイ・画像セットを重複なく拾う", () => {
  const imageSets = [{ data1Index: 9, lba: 500, size: 100 }];
  const songRow = (song: number) =>
    row([
      "song",
      String(song),
      "0",
      "t",
      "k",
      "1",
      JSON.stringify([{ newAbcIndex: song, lba: 100 * song, sourceSize: 7 }]),
      JSON.stringify({ lba: 300, newData1Index: 5, sectors: 2 }),
      JSON.stringify({
        packages: [{ lba: 400, newData1Index: 6, sectors: 1 }],
      }),
      "-",
      "-",
      "-",
    ]);
  const tsv = [
    "record_type\ttarget_song",
    row(["assets", "", "", "", "", "2", "", "", "", "1", "2", "3"]),
    row([
      "data1",
      "",
      "",
      "",
      "",
      "1",
      "",
      JSON.stringify(imageSets),
      "[]",
      "1",
      "2",
      "3",
    ]),
    songRow(1),
    songRow(2),
  ].join("\n") + "\n";
  assertEquals(extentsOfPlan(tsv), [
    { key: "abc/1", lba: 100, size: 7 },
    { key: "abc/2", lba: 200, size: 7 },
    { key: "data1/image_set/9", lba: 500, size: 100 },
    { key: "data1/overlay/6", lba: 400, size: 2048 },
    { key: "data1/title_card/5", lba: 300, size: 4096 },
  ]);
});

Deno.test("曲名カードもオーバーレイも無い曲は資産だけを返す", () => {
  const tsv = "h\n" + row([
    "song",
    "1",
    "0",
    "t",
    "k",
    "1",
    JSON.stringify([{ newAbcIndex: 3, lba: 10, sourceSize: 5 }]),
    "-",
    "-",
    "-",
    "-",
    "-",
  ]) + "\n";
  assertEquals(extentsOfPlan(tsv), [{ key: "abc/3", lba: 10, size: 5 }]);
});
