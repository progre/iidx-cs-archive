// ffmpegを2つつなぎ、MPEG-PSの表示比を書き換えてからmkvへ入れる。

import { isMpegPs, muxArgs, squareArgs } from "./mpeg_ps.ts";

function spawnFfmpeg(
  args: string[],
  stdout: "piped" | "null",
): Deno.ChildProcess {
  return new Deno.Command("ffmpeg", {
    args,
    stdin: "piped",
    stdout,
    stderr: "piped",
  }).spawn();
}

async function writeAll(stdin: WritableStream<Uint8Array>, bytes: Uint8Array) {
  const writer = stdin.getWriter();
  await writer.write(bytes);
  await writer.close();
}

async function waitSuccess(child: Deno.ChildProcess, outPath: string) {
  const [status, message] = await Promise.all([
    child.status,
    new Response(child.stderr).text(),
  ]);
  if (!status.success) {
    throw new Error(
      `ffmpegが失敗(code=${status.code}): ${outPath}\n${message.trim()}`,
    );
  }
}

export async function writeMkv(
  mpeg: Uint8Array,
  outPath: string,
): Promise<void> {
  if (!isMpegPs(mpeg)) {
    throw new Error(`MPEG-PSのパックヘッダーで始まらない: ${outPath}`);
  }
  const square = spawnFfmpeg(squareArgs(), "piped");
  const mux = spawnFfmpeg(muxArgs(outPath), "null");
  await Promise.all([
    writeAll(square.stdin, mpeg),
    square.stdout.pipeTo(mux.stdin),
    waitSuccess(square, outPath),
    waitSuccess(mux, outPath),
  ]);
}
