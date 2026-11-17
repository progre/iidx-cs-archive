import { assertEquals } from "@std/assert";
import { isDiscDrive } from "./optical_drives.ts";

const encoder = new TextEncoder();
const empty = new Uint8Array();

Deno.test("ISO9660のディスクが入ったドライブを選ぶ", () => {
  const stdout = encoder.encode("\x01CD001");
  assertEquals(isDiscDrive({ stdout, stderr: "" }), true);
});

Deno.test("読めてもISO9660でないドライブは選ばない", () => {
  const stdout = encoder.encode("NTFS");
  assertEquals(isDiscDrive({ stdout, stderr: "" }), false);
});

Deno.test("開けたのに読めないドライブは、空のドライブとして選ぶ", () => {
  const stderr = "Error during demuxing: Permission denied";
  assertEquals(isDiscDrive({ stdout: empty, stderr }), true);
});

Deno.test("開けないドライブと存在しないドライブは選ばない", () => {
  for (const reason of ["Permission denied", "No such file or directory"]) {
    const stderr = `Error opening input: ${reason}`;
    assertEquals(isDiscDrive({ stdout: empty, stderr }), false);
  }
});
