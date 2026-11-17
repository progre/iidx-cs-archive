// 世代の周回で、曲名カードとオーバーレイの`.if`を書く。
// 周回では収録の候補をすべて書く。選外になった曲の`.if`も、次のビルドが使い回すので消さない。
// 曲名カードとオーバーレイは、世代の収録の候補と原盤だけから決まる。
// そのため、収録の候補が前のビルドと同じなら、前のビルドの記録を使い、`.if`を書き直さない。

import type { DisplaySong } from "@csa/core";
import { prepareLegacyTitleCards, prepareTitleCards } from "./cards/mod.ts";
import { type LapDisplaySong, lapDisplaySongs } from "./lap_songs.ts";
import { prepareOverlays } from "./overlay/mod.ts";
import type {
  DisplayLapPorts,
  DisplayLapTypes,
  DisplayManifest,
  ElfOf,
  LapDisc,
} from "./ports.ts";
import {
  type DisplayLapRecord,
  fileExists,
  readDisplayLapRecord,
  removeDisplayLapRecord,
  writeDisplayLapRecord,
} from "./record_gateway.ts";

/** 周回で書いた1世代分の結果 */
export interface DisplayLap<ImageSet> {
  /** 置いた`.if` */
  files: string[];
  generation: string;
  /** 画像セットの組み立てが後で要るもの。取り出したspriteは、ファイルに書いてある */
  imageSet: ImageSet;
  /** `<世代>/<曲番号>` → 周回で整えた曲名カードとオーバーレイ */
  songs: Map<string, LapDisplaySong>;
}

export interface DisplayDirectories {
  /** 周回の成果物を世代ごとに置く場所。曲名カード・オーバーレイの`.if`と、取り出したspriteをここに置く */
  discsDirectory: string;
  /** 前のビルドの記録を、入力が同じなら使う。`--full`では偽 */
  reuse: boolean;
}

type CardsAndOverlays = Pick<DisplayLap<unknown>, "files" | "songs">;

async function prepareCardsAndOverlays<T extends DisplayLapTypes>(
  ports: DisplayLapPorts<T>,
  manifest: DisplayManifest,
  lap: LapDisc<T["disc"]>,
  elfOf: ElfOf<T["elf"]>,
  discsDirectory: string,
): Promise<CardsAndOverlays> {
  const { generation } = lap;
  console.time("time " + generation + " title cards");
  const cards = ports.hasDisplayAssets(generation)
    ? await prepareTitleCards(ports, manifest, discsDirectory, lap)
    : prepareLegacyTitleCards(
      ports,
      manifest,
      generation,
      elfOf(generation),
      discsDirectory,
    );
  console.timeEnd("time " + generation + " title cards");
  console.time("time " + generation + " overlays");
  const overlays = await prepareOverlays(
    ports,
    cards.manifest,
    discsDirectory,
    elfOf,
    lap,
  );
  console.timeEnd("time " + generation + " overlays");
  return {
    files: [...cards.files, ...overlays.files],
    songs: lapDisplaySongs(
      overlays.manifest.songs,
      overlays.repackedSongs,
      overlays.droppedKeys,
    ),
  };
}

/** 前のビルドの記録を読み、使えるなら返す。入力が同じで、置いた`.if`がすべてあるときだけ使う */
function reusableRecord(
  path: string,
  input: string,
): DisplayLapRecord | undefined {
  const record = readDisplayLapRecord(path);
  const same = record !== undefined &&
    record.input === input &&
    record.files.every(fileExists);
  return same ? record : undefined;
}

/** 曲名カードとオーバーレイの処理が読む項目だけを持つ、その世代だけのmanifest */
export const lapDisplayManifest = (
  songs: DisplaySong[],
  generation: string,
  source: DisplayManifest["sources"][string],
): DisplayManifest => ({ songs, sources: { [generation]: source } });

/** `manifest`は、その世代の収録の候補だけを持つ。`elfOf`は世代の実行ファイルを引く */
export async function prepareDisplayOfLap<T extends DisplayLapTypes>(
  ports: DisplayLapPorts<T>,
  manifest: DisplayManifest,
  generation: string,
  disc: T["disc"],
  { discsDirectory, reuse }: DisplayDirectories,
  elfOf: ElfOf<T["elf"]>,
): Promise<DisplayLap<T["imageSet"]>> {
  // 周回の実行ファイルはこの世代の1枚だけである。1回だけ読む
  const elf = elfOf(generation);
  const lapElfOf = (target: string) =>
    target === generation ? elf : elfOf(target);
  const recordPath = `${discsDirectory}/${generation}/display.json`;
  const input = JSON.stringify(manifest);
  const saved = reuse ? reusableRecord(recordPath, input) : undefined;
  console.log(
    `${generation} title cards and overlays: ${saved ? "reused" : "rebuilt"}`,
  );
  const prepared: CardsAndOverlays = saved === undefined
    ? await (async () => {
      removeDisplayLapRecord(recordPath);
      const made = await prepareCardsAndOverlays(
        ports,
        manifest,
        { disc, generation },
        lapElfOf,
        discsDirectory,
      );
      // 記録は、`.if`を書き終えてから書く
      writeDisplayLapRecord(recordPath, {
        files: made.files,
        input,
        songs: [...made.songs],
      });
      return made;
    })()
    : { files: saved.files, songs: new Map(saved.songs) };
  console.time("time " + generation + " image sets");
  const imageSet = await ports.readImageSetLap({
    disc,
    elf,
    generation,
    songs: manifest.songs,
    discsDirectory,
  });
  console.timeEnd("time " + generation + " image sets");
  return { ...prepared, generation, imageSet };
}
