// 原盤を読んでCSAのISOを作る。
// 引数: [--clean] [--full] [--images] [--slot] [--song-list-only] [--verify] [--write-plan]
// 原盤は物理ドライブから読む。ドライブは実行中に選ぶ。
// `--images`は、原盤をイメージファイルから読む開発者向けの引数である。
// `--slot`は、ISOを2つの枠へ交互に書く開発者向けの引数である。
// `--song-list-only`を付けると、曲リストのHTMLとJSONだけを書き、ISOは作らない。
// 中間ファイルは、周回の成果物を`build/intermediate/discs/<世代>/`、
// 全世代を集めた後のものを`build/intermediate/iso/`に書く。
// ISOと実行の記録は`build/`に書く。
// 周回の中間ファイルは、入力が前のビルドと同じなら使い回す。
// `--full`を付けると、使い回さずにすべて作り直す。era1のムービーの変換もやり直す。
// `--clean`を付けると、`build/intermediate/`を消して終わる。
// ISOと実行の記録は消さない。
//
// run/: 全工程の順序
// laps/: 原盤を1枚ずつ読む周回の手順
// ports/: features へ他の feature の実装を渡す配線

import { parseArgs } from "@std/cli/parse-args";
import {
  type DiscOpener,
  driveOpener,
  imageFileOpener,
  listOpticalDrives,
  readDiscFolders,
} from "@csa/containers-disc";
import { BUILD_DIRECTORY, INTERMEDIATE_DIRECTORY } from "@csa/core";
import { removeIntermediate } from "@csa/layout-iso-slot";
import {
  elfFileNameOf,
  eraOf,
  GENERATIONS,
  LAP_ORDER,
  PB_GENERATION,
} from "@csa/selection-definitions";
import { assembleSongRows, DISCS_DIRECTORY } from "@csa/selection-manifest";
import { DISC_TITLES, ISO_STAGE_TITLE } from "./disc_titles.ts";
import { runLaps } from "./laps/mod.ts";
import { makeManifest } from "./ports/song/mod.ts";
import { buildIso } from "./run/mod.ts";
import { type BuildProgress, plainProgress } from "./tui/plain_progress.ts";

const ERA1_PARALLEL = 3;
const ISO_STAGE = "ISO";
const LOG_DIRECTORY = `${BUILD_DIRECTORY}/logs`;
const LOG_FILE = `${LOG_DIRECTORY}/build.log`;
const BELL = new TextEncoder().encode("\x07");

/**
 * 物理ディスクから読む。ドライブを選び、以降のログはファイルへ書いて工程の一覧を描く。
 * `verify`は、ISOの工程に照合の作業があるかを決める
 */
async function driveSession(verify: boolean): Promise<
  { openDisc: DiscOpener; progress: BuildProgress }
> {
  const { isoSteps, lapSteps, listrProgress, redirectConsoleTo, selectDrive } =
    await import("./tui/mod.ts");
  const drive = await selectDrive(await listOpticalDrives());
  Deno.mkdirSync(LOG_DIRECTORY, { recursive: true });
  console.log(`log: ${LOG_FILE}`);
  const progress = listrProgress(
    [...LAP_ORDER, ISO_STAGE],
    (name) => name === ISO_STAGE ? ISO_STAGE_TITLE : DISC_TITLES[name],
    (name) => {
      if (name === ISO_STAGE) {
        return isoSteps(verify);
      }
      // PBは`eraOf`に登録されていないので、eraを引く前に分ける
      const pb = name === PB_GENERATION;
      return lapSteps({ era1: !pb && eraOf(name) === "era1", pb });
    },
  );
  redirectConsoleTo(LOG_FILE, progress);
  const discOf = (generation: string) => ({
    elfName: elfFileNameOf(generation),
    title: DISC_TITLES[generation],
  });
  const openDisc = driveOpener(drive, discOf, {
    alert: () => Deno.stdout.writeSync(BELL),
    prompt: progress.wait,
    reading: progress.resume,
  });
  return { openDisc, progress };
}

/** 開発者向けに、イメージファイルから読む */
const imageSession = () => ({
  openDisc: imageFileOpener(readDiscFolders()),
  progress: plainProgress,
});

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: [
      "clean",
      "full",
      "images",
      "slot",
      "song-list-only",
      "verify",
      "write-plan",
    ],
    unknown: (arg) => {
      throw new Error(`unknown argument: ${arg}`);
    },
  });
  if (args.clean) {
    removeIntermediate();
    console.log(`removed intermediates: ${INTERMEDIATE_DIRECTORY}`);
    return;
  }

  // 原盤は周回で1枚ずつ読む。era1のムービーの変換と音のbundle、曲名カードとオーバーレイの`.if`の書き出しも、周回の中で行う
  const { full } = args;
  const { openDisc, progress } = args.images
    ? imageSession()
    : await driveSession(args.verify);
  const laps = await runLaps({
    discsDirectory: DISCS_DIRECTORY,
    era1: {
      parallel: ERA1_PARALLEL,
      reconvert: full,
      tmpDir: `${INTERMEDIATE_DIRECTORY}/video_era1_tmp`,
    },
    openDisc,
    reuse: !full,
  }, progress.stage);
  await progress.stage(ISO_STAGE, async () => {
    // PBの原盤は、ISOの書き込みと検証が終わるまで開いておく
    using _pb = laps.pb;
    // 曲の行とmanifestはファイルに書かず、値のままISOを作る処理へ渡す
    console.time("time song rows and manifest");
    const songs = assembleSongRows(laps.rowsOf, GENERATIONS);
    const made = makeManifest(songs, laps.songs);
    console.timeEnd("time song rows and manifest");
    await buildIso({
      full,
      removed: made.removed,
      slot: args.slot,
      songListOnly: args["song-list-only"],
      sourceManifest: made.manifest,
      verify: args.verify,
      writePlan: args["write-plan"],
    }, laps);
  });
  await progress.finish();
}

if (import.meta.main) {
  await main();
}
