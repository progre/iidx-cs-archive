// CSAのISOを書き出し、読み戻して検査する。
// 原盤のELFと収録内容の扱いは`planIso`が行う。ここは枠の選択、書き出し、読み戻しを行う。

import type { LapInputs } from "./prepare_assets.ts";
import { readIopModulePatches } from "@csa/contents-elf";
import { planLines } from "@csa/layout-iso-plan";
import { SONG_LIST_REPORT, writeIsoOutput } from "@csa/layout-iso-slot";
import { manifestAssetSources, verifyImage, writeImage } from "./write.ts";
import { planIso, type Run } from "./plan_iso.ts";
import { writeSongListOf } from "./song_list_writer.ts";

export async function buildIso(run: Run, laps: LapInputs): Promise<void> {
  if (run.songListOnly) {
    await writeSongListOf(run, laps);
    console.log("wrote only the song list (--song-list-only); no ISO written");
    return;
  }
  console.time("time ISO plan");
  const planned = await planIso(run, laps);
  console.timeEnd("time ISO plan");
  const { elfPlacement, image, manifest, metadata, outputElf, plan } = planned;
  const log = console.log;
  planLines(planned, SONG_LIST_REPORT).forEach(log);

  const writeInput = {
    assetSources: manifestAssetSources(
      manifest,
      planned.prepared.bundles,
      planned.prepared.openChartImage,
      planned.chartKey,
    ),
    elfBytes: outputElf.bytes,
    elfPlacement,
    plan,
    sourcePatches: await readIopModulePatches(image.iopModule, laps.pb),
    sourceVolumeSectors: image.volumeSectors,
  };
  const outputPath = await writeIsoOutput(run.slot, log, async (path) => {
    console.time("time ISO write");
    await writeImage(
      { ...writeInput, outputPath: path },
      metadata,
      log,
      laps.pb.borrowedImage(),
    );
    console.timeEnd("time ISO write");
  });
  if (run.verify) {
    console.time("time ISO verify");
    await verifyImage(
      { ...writeInput, outputPath },
      metadata,
      planned.relocations,
      log,
      laps.pb.borrowedImage(),
    );
    console.timeEnd("time ISO verify");
    log(
      "read-back OK: PVD, directory records, ELF, embedded file table, assets, " +
        "title cards, overlays, source area",
    );
  } else {
    log("not verified (--verify reads the written ISO back and compares it)");
  }
}
