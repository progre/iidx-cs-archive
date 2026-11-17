// 選んだWindowsの光学ドライブから原盤を開く。

import { delay } from "@std/async";
import type { DiscOpener } from "../generation_disc.ts";
import { ffmpegDevice } from "./ffmpeg_device.ts";
import { devicePathOf } from "./optical_drives.ts";
import {
  type ExpectedDisc,
  type WaitDisplay,
  waitForDisc,
} from "./wait_disc.ts";

const POLL_MILLISECONDS = 2000;

/** 物理ドライブから読む。世代ごとに、その世代の原盤が入るまで待つ */
export function driveOpener(
  drive: string,
  discOf: (generation: string) => ExpectedDisc,
  display: WaitDisplay,
): DiscOpener {
  let previous: ExpectedDisc | null = null;
  return async (generation) => {
    const expected = discOf(generation);
    const opened = await waitForDisc(expected, previous, {
      ...display,
      drive,
      openDevice: () => Promise.resolve(ffmpegDevice(devicePathOf(drive))),
      sleep: () => delay(POLL_MILLISECONDS),
    });
    previous = expected;
    return opened;
  };
}
