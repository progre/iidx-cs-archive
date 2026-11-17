// ビルドが`build/`の直下に書くファイルと、中間ファイルの置き場の操作。
// 置き場は変えない。

import { BUILD_DIRECTORY, INTERMEDIATE_DIRECTORY } from "@csa/core";

/** ISOの名前。2枠を交互に使うときは、枠の中身を表す名前として台帳に書く */
export const ISO_CONTENT_NAME = "iidx-cs-archive.iso";

/** 枠を使わないときに書くISO */
export const ISO_PATH = `${BUILD_DIRECTORY}/${ISO_CONTENT_NAME}`;

/** 全曲・譜面一覧のHTML */
export const SONG_LIST_REPORT = `${BUILD_DIRECTORY}/song_list.html`;

/** 全曲・譜面一覧のHTMLの元データ */
export const SONG_LIST_DATA = `${BUILD_DIRECTORY}/song_list.json`;

/** 中間ファイルの置き場を丸ごと消す(`--clean`)。置き場が無ければ何もしない */
export function removeIntermediate(): void {
  try {
    Deno.removeSync(INTERMEDIATE_DIRECTORY, { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}
