import { assertEquals, assertRejects } from "@std/assert";
import { SEC } from "@csa/core";
import type { SectorDevice } from "./sector_image.ts";
import { waitForDisc, type WaitPorts } from "./wait_disc.ts";

const ROOT_SECTOR = 18;
const encoder = new TextEncoder();

function recordOf(name: string, sector: number, isDir: boolean): Uint8Array {
  const nameBytes = encoder.encode(name);
  const record = new Uint8Array(33 + nameBytes.length + 1);
  const view = new DataView(record.buffer);
  record[0] = record.length;
  view.setUint32(2, sector, true);
  view.setUint32(10, SEC, true);
  record[25] = isDir ? 2 : 0;
  record[32] = nameBytes.length;
  record.set(nameBytes, 33);
  return record;
}

/** ルートに`elfName`だけを持つ最小のISO9660 */
function deviceWith(elfName: string): SectorDevice & { closed: () => boolean } {
  const disc = new Uint8Array(20 * SEC);
  const view = new DataView(disc.buffer);
  const pvd = 16 * SEC;
  disc[pvd] = 1;
  disc.set(encoder.encode("CD001"), pvd + 1);
  view.setUint32(pvd + 80, 20, true);
  disc.set(recordOf("\0", ROOT_SECTOR, true), pvd + 156);
  const dot = recordOf("\0", ROOT_SECTOR, true);
  const dotdot = recordOf("\x01", ROOT_SECTOR, true);
  const elf = recordOf(`${elfName};1`, 19, false);
  disc.set(dot, ROOT_SECTOR * SEC);
  disc.set(dotdot, ROOT_SECTOR * SEC + dot.length);
  disc.set(elf, ROOT_SECTOR * SEC + dot.length + dotdot.length);
  let closed = false;
  return {
    readSectors: (first, buffer) => {
      buffer.set(disc.subarray(first * SEC, first * SEC + buffer.length));
      return Promise.resolve();
    },
    close: () => {
      closed = true;
    },
    closed: () => closed,
  };
}

function portsOf(
  steps: readonly (() => Promise<SectorDevice>)[],
): WaitPorts & { lines: string[]; sleeps: () => number } {
  const lines: string[] = [];
  let opened = 0;
  let sleeps = 0;
  return {
    drive: "J:",
    lines,
    sleeps: () => sleeps,
    openDevice: () => steps[opened++](),
    alert: () => lines.push("bell"),
    prompt: (line) => lines.push(`! ${line}`),
    reading: () => lines.push("reading"),
    sleep: () => {
      sleeps++;
      return Promise.resolve();
    },
  };
}

const EXPECTED = { title: "Game A", elfName: "SLPM_000.01" };
const notReady = () => Promise.reject(new Error("not ready"));

Deno.test("空のドライブでは、挿入を1回だけ促して読めるまで待つ", async () => {
  const device = deviceWith("SLPM_000.01");
  const ports = portsOf([notReady, notReady, () => Promise.resolve(device)]);
  const opened = await waitForDisc(EXPECTED, null, ports);
  assertEquals(opened.files.has("SLPM_000.01"), true);
  assertEquals(ports.sleeps(), 2);
  assertEquals(device.closed(), false);
  assertEquals(ports.lines, [
    "bell",
    '! Insert "Game A" (SLPM-00001) into drive J:',
    "reading",
  ]);
});

Deno.test("ベルは待ち始めと間違ったディスクで鳴らし、抜いたときは鳴らさない", async () => {
  const ports = portsOf([
    notReady,
    () => Promise.resolve(deviceWith("SLPM_000.05")),
    notReady,
    () => Promise.resolve(deviceWith("SLPM_000.01")),
  ]);
  await waitForDisc(EXPECTED, null, ports);
  assertEquals(ports.lines, [
    "bell",
    '! Insert "Game A" (SLPM-00001) into drive J:',
    "bell",
    '! This is not the right disc. Insert "Game A" (SLPM-00001) into drive J:',
    '! Insert "Game A" (SLPM-00001) into drive J:',
    "reading",
  ]);
});

Deno.test("読み終えたディスクが入ったままなら、閉じて次のディスクを案内する", async () => {
  const finished = deviceWith("SLPM_000.09");
  const ports = portsOf([
    () => Promise.resolve(finished),
    () => Promise.resolve(deviceWith("SLPM_000.01")),
  ]);
  const previous = { title: "Game Z", elfName: "SLPM_000.09" };
  await waitForDisc(EXPECTED, previous, ports);
  assertEquals(finished.closed(), true);
  assertEquals(ports.lines, [
    "bell",
    '! Insert "Game A" (SLPM-00001) into drive J:',
    "reading",
  ]);
});

Deno.test("権限の不足は待たずに投げる", async () => {
  const ports = portsOf([
    () => Promise.reject(new Deno.errors.NotCapable("denied")),
  ]);
  await assertRejects(
    () => waitForDisc(EXPECTED, null, ports),
    Deno.errors.NotCapable,
  );
  assertEquals(ports.sleeps(), 0);
});
