// ffmpegの起動。引数と結果の解釈は呼び出し側が決める。

/** 警告以下を出さずに実行する。失敗したときは、標準エラーの内容を例外のメッセージに入れる */
export async function runFfmpeg(args: string[]): Promise<void> {
  const result = await new Deno.Command("ffmpeg", {
    args: ["-v", "error", "-y", ...args],
    stderr: "piped",
    stdout: "null",
  }).output();
  if (!result.success) {
    throw new Error("ffmpeg失敗: " + new TextDecoder().decode(result.stderr));
  }
}
