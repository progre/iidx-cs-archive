// ドライブをffmpegで読む。Denoの`\\.\J:`は読めないので、権限を増やさずに読める手段としてffmpegを使う。

import { SEC } from "@csa/core";
import { devicePathOf, DRIVE_NAMES, isDiscDrive } from "./optical_drives.ts";
import type { SectorDevice } from "./sector_image.ts";

const PVD_SECTOR = 16;

/** 指定の範囲を標準出力へ書く引数。`data`形式は中身を解釈しない */
export const readRangeArgs = (
  path: string,
  firstSector: number,
  length: number,
): string[] => [
  "-nostdin",
  "-v",
  "error",
  "-f",
  "data",
  "-skip_initial_bytes",
  String(firstSector * SEC),
  "-i",
  path,
  "-map",
  "0",
  "-c",
  "copy",
  "-fs",
  String(length),
  "-f",
  "data",
  "pipe:1",
];

/** 読めない理由をログで比べるので、実行ごとに変わるアドレスを除く */
const stderrOf = (bytes: Uint8Array) =>
  new TextDecoder().decode(bytes).replace(/ @ [0-9a-f]+/g, "").trim();

async function readRange(path: string, firstSector: number, length: number) {
  const result = await new Deno.Command("ffmpeg", {
    args: readRangeArgs(path, firstSector, length),
    stderr: "piped",
    stdout: "piped",
  }).output();
  return { stdout: result.stdout, stderr: stderrOf(result.stderr) };
}

export const ffmpegDevice = (path: string): SectorDevice => ({
  readSectors: async (firstSector, buffer) => {
    const { stdout, stderr } = await readRange(
      path,
      firstSector,
      buffer.length,
    );
    if (stdout.length < buffer.length) {
      throw new Error(
        `ドライブを読めない: sector=${firstSector} want=${buffer.length} got=${stdout.length} ${stderr}`,
      );
    }
    buffer.set(stdout.subarray(0, buffer.length));
  },
  close: () => {},
});

/** 原盤を入れるドライブの名前を、`D:`の形で返す */
export async function listOpticalDrives(): Promise<string[]> {
  const probes = await Promise.all(
    DRIVE_NAMES.map((drive) => readRange(devicePathOf(drive), PVD_SECTOR, SEC)),
  );
  return DRIVE_NAMES.filter((_, at) => isDiscDrive(probes[at]));
}
