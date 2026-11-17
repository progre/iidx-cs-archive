// 曲・譜面の一覧を書く関数を、実行の設定と周回の結果で呼ぶ。

import {
  ISO_CONTENT_NAME,
  SONG_LIST_DATA,
  SONG_LIST_REPORT,
} from "@csa/layout-iso-slot";
import { groupedCatalogs, writeSongListFiles } from "../ports/song/mod.ts";
import type { LapInputs } from "./prepare_assets.ts";
import { prepareAssets, type PreparedAssets } from "./prepare_assets.ts";
import type { SongListRun } from "@csa/report-song-list";

export const writeSongListOf = (
  run: SongListRun,
  laps: LapInputs,
): Promise<PreparedAssets> =>
  writeSongListFiles(run, laps, {
    catalogs: groupedCatalogs(),
    label: ISO_CONTENT_NAME,
    prepare: () => prepareAssets(run.sourceManifest, laps),
    report: { data: SONG_LIST_DATA, html: SONG_LIST_REPORT },
  });
