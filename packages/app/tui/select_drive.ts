// ドライブを選ぶ。1台だけなら選ぶ画面を出さない。

import { Select } from "@cliffy/prompt/select";

export async function selectDrive(drives: string[]): Promise<string> {
  if (drives.length === 0) {
    throw new Error("光学ドライブが見つからない。ディスクを入れて実行し直す");
  }
  if (drives.length === 1) {
    return drives[0];
  }
  return await Select.prompt({ message: "Select a drive", options: drives });
}
