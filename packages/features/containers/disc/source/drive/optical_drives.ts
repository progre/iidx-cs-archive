// ドライブ文字ごとにPVDの位置を読んだ結果から、原盤を入れるドライブを見分ける。
// ffmpegの結果はWindowsの実機で確かめた。ドライブの種類を読むAPIは、Denoの権限では使えない。

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const ISO9660_MAGIC = "CD001";
const NOT_A_DRIVE =
  /Error opening input: (No such file or directory|Permission denied)/;

export const DRIVE_NAMES: readonly string[] = [...LETTERS].map((letter) =>
  `${letter}:`
);

export const devicePathOf = (drive: string): string => `\\\\.\\${drive}`;

/**
 * 読めてISO9660ならディスクが入っている。読めてISO9660でないなら、光学ドライブではない。
 * 開けたのに読めないなら、空のドライブである。
 */
export function isDiscDrive(probe: { stdout: Uint8Array; stderr: string }) {
  if (probe.stdout.length > 0) {
    const magic = new TextDecoder().decode(probe.stdout.subarray(1, 6));
    return magic === ISO9660_MAGIC;
  }
  return probe.stderr !== "" && !NOT_A_DRIVE.test(probe.stderr);
}
