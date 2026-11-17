import { assertEquals } from "@std/assert";
import { SEC } from "@csa/core";
import { type SectorDevice, SectorDiscImage } from "./sector_image.ts";

const VOLUME_SECTORS = 20;

function deviceOf(): { device: SectorDevice; requests: number[][] } {
  const disc = Uint8Array.from(
    { length: VOLUME_SECTORS * SEC },
    (_, index) => index % 251,
  );
  new DataView(disc.buffer).setUint32(16 * SEC + 80, VOLUME_SECTORS, true);
  const requests: number[][] = [];
  return {
    requests,
    device: {
      readSectors: (first, buffer) => {
        requests.push([first, buffer.length]);
        buffer.set(disc.subarray(first * SEC, first * SEC + buffer.length));
        return Promise.resolve();
      },
      close: () => {},
    },
  };
}

Deno.test("大きさはPVDのセクター数から決まる", async () => {
  const image = await SectorDiscImage.open(deviceOf().device);
  assertEquals(image.size, VOLUME_SECTORS * SEC);
});

Deno.test("セクターをまたいで読むときは、両端を含むセクターを読む", async () => {
  const { device, requests } = deviceOf();
  const image = await SectorDiscImage.open(device);
  const read = await image.readAt(SEC - 2, 4);
  assertEquals(requests.at(-1), [0, 2 * SEC]);
  assertEquals(Array.from(read), [
    (SEC - 2) % 251,
    (SEC - 1) % 251,
    SEC % 251,
    (SEC + 1) % 251,
  ]);
});

Deno.test("位置と長さがセクターの倍数なら、受け取ったバッファーへ直接読む", async () => {
  const { device, requests } = deviceOf();
  const image = await SectorDiscImage.open(device);
  const buffer = new Uint8Array(SEC);
  await image.readInto(2 * SEC, buffer);
  assertEquals(requests.at(-1), [2, SEC]);
  assertEquals(buffer[0], (2 * SEC) % 251);
});
