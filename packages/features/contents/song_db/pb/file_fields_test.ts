import { assertEquals } from "@std/assert";
import { PB_DEFINITION, PB_FORMAT } from "./testing.ts";
import {
  readFileFields,
  redirectEntryVideo,
  writeEntryVersion,
} from "./file_fields.ts";

const { chart, selection, video } = PB_DEFINITION.songDbRecordLayout;
const CHARTS = chart.files.offset;
const SOUNDS = chart.sounds.offset;
const VIDEO = video.primary.offset;
const FLAGS = video.unkPb62Offset!;
const VERSION = selection.origin!.offset;

function entryWith(write: (view: DataView) => void): Uint8Array {
  const entry = new Uint8Array(PB_FORMAT.size);
  write(new DataView(entry.buffer));
  return entry;
}

Deno.test("使っているフィールドだけを、種別ごとに読む", () => {
  const entry = entryWith((view) => {
    view.setUint32(VIDEO, 7, true);
    view.setUint32(VIDEO + 4, 0xffffffff, true);
    view.setUint32(CHARTS + 8, 9, true);
    view.setUint16(SOUNDS, 0xffff, true);
    view.setUint16(SOUNDS + 2, 5, true);
  });
  const fields = readFileFields(PB_FORMAT, entry);
  assertEquals(fields.video, [
    { fieldOffset: VIDEO, fileIndex: 7, width: "u32" },
  ]);
  assertEquals(fields.chart, [
    { fieldOffset: CHARTS + 8, fileIndex: 9, width: "u32" },
  ]);
  assertEquals(fields.sound, [
    { fieldOffset: SOUNDS + 2, fileIndex: 5, width: "u16" },
  ]);
});

Deno.test("作品番号はu16で書く", () => {
  const entry = new Uint8Array(PB_FORMAT.size);
  writeEntryVersion(PB_FORMAT, entry, 0x1234);
  assertEquals(entry[VERSION], 0x34);
  assertEquals(entry[VERSION + 1], 0x12);
});

Deno.test("ムービーの印の下位2bitだけを書き換え、他のbitは残す", () => {
  const entry = new Uint8Array(PB_FORMAT.size);
  entry[FLAGS] = 0x83;
  const result = PB_FORMAT.decode(
    redirectEntryVideo(PB_FORMAT, PB_FORMAT.encode(entry), 0x02, [], undefined),
  );
  assertEquals(result[FLAGS], 0x82);
});

Deno.test("ABC indexがあれば、ムービーのフィールドをそのABC indexに書き換える", () => {
  const encoded = PB_FORMAT.encode(new Uint8Array(PB_FORMAT.size));
  const result = PB_FORMAT.decode(
    redirectEntryVideo(PB_FORMAT, encoded, 0, [VIDEO, VIDEO + 4], 900),
  );
  const view = new DataView(result.buffer);
  assertEquals(view.getUint32(VIDEO, true), 900);
  assertEquals(view.getUint32(VIDEO + 4, true), 900);
});
