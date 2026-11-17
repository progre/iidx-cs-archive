// 組んだオーバーレイを`<discsDirectory>/<世代>/overlays/`へ置く。
// 曲DBに枠が無い曲は、nullを返す。
// 呼び出し側は、その曲に`overlay`を渡さない。
// この回に書いたファイルは組み直さない(並べ替えと同じ扱い)。周回の中で呼ぶ。

import { openIfs, type TileOf } from "../../legacy/mod.ts";
import {
  isLostOverlay,
  type LegacyIfsSlice,
  type LegacyOverlay,
  overlayFileName,
  overlayPairs,
  tileResolver,
  withHoldFrames,
} from "../../legacy_overlay/mod.ts";
import type { LegacyOverlayWritePorts } from "./ports.ts";
import { buildLegacyOverlay } from "./build.ts";

// オーバーレイを組んで書く処理が、周回で開いた原盤を読むのに使う型。

export type ElfOf = (generation: string) => Uint8Array;

/** 素材のアーカイブを読み、この回に書いた`.if`を覚える */
export interface LapRepacker {
  read: (input: {
    archive?: string;
    generation: string;
    sourceOffset: number;
    sourceSize: number;
  }) => Promise<Uint8Array>;
  record: (path: string, size: number) => void;
  writtenSize: (path: string) => number | undefined;
}

export interface LegacyOverlaySong {
  generation: string;
  songId: number;
}

export interface LegacyOverlayInput extends LegacyOverlaySong {
  /** manifestの`holdFrames` */
  holdFrames?: number;
  ifs: LegacyIfsSlice | null;
}

export interface LegacyOverlayFile {
  pairs: (number | null)[];
  path: string;
  reused: boolean;
  /** 組み直したときだけ数える */
  sheets: number;
  size: number;
}

interface Loaded {
  elf: Uint8Array;
  resolve: (ifs: TileOf | null) => TileOf;
  source: LegacyOverlay;
}

/** 世代ごとにELFと曲ごとの`IFs`を1回だけ読む。出力は世代ごとのフォルダーへ置く。世代をまたぐ曲は、世代ごとにまとめて渡す */
export class LegacyOverlayWriter {
  readonly #loaded: (generation: string) => Loaded;
  readonly #ports: LegacyOverlayWritePorts;
  readonly #repacker: LapRepacker;
  readonly #discsDirectory: string;

  /** `elfOf`は世代の原盤の実行ファイルを引く */
  constructor(
    ports: LegacyOverlayWritePorts,
    discsDirectory: string,
    repacker: LapRepacker,
    elfOf: ElfOf,
  ) {
    this.#ports = ports;
    this.#loaded = ports.forCurrentGeneration((generation) => {
      const elf = elfOf(generation);
      return {
        elf,
        resolve: tileResolver(generation, elf),
        source: ports.openLegacyOverlay(generation, elf),
      };
    });
    this.#repacker = repacker;
    this.#discsDirectory = discsDirectory;
  }

  lost(song: LegacyOverlaySong, hasIfs: boolean): boolean {
    return isLostOverlay(this.#load(song).source.songOf(song.songId), hasIfs);
  }

  async write(input: LegacyOverlayInput): Promise<LegacyOverlayFile | null> {
    const loaded = this.#load(input);
    const { holdFrames } = input;
    const read = loaded.source.songOf(input.songId).slots;
    if (read.length === 0) return null;
    const slots = holdFrames === undefined
      ? read
      : withHoldFrames(read, holdFrames);
    const pairs = overlayPairs(slots, loaded.source.slotCount);
    const directory = this.#ports.ifDirectoryOf(
      this.#discsDirectory,
      input.generation,
      "overlays",
    );
    // 縮める長さはBPMで変わるので、同じ絵でも長さが違えば別のファイルにする
    const name = overlayFileName(input.ifs?.fileIndex ?? null, slots) +
      (holdFrames === undefined ? "" : `_hold${holdFrames}`);
    const path = this.#ports.ifFilePathOf(directory, name);
    const known = this.#repacker.writtenSize(path);
    if (known !== undefined) {
      return { pairs, path, reused: true, sheets: 0, size: known };
    }
    const built = buildLegacyOverlay(
      this.#ports,
      input.generation,
      loaded.elf,
      loaded.resolve(await this.#openIfs(input)),
      slots,
    );
    if (!built.fits) {
      throw new Error(
        `${input.generation} song${input.songId}のsheetが${built.sheets}枚`,
      );
    }
    const padded = this.#ports.padToSector(built.bytes);
    this.#ports.writeIfFile(directory, path, padded);
    this.#repacker.record(path, padded.length);
    return {
      pairs,
      path,
      reused: false,
      sheets: built.sheets,
      size: padded.length,
    };
  }

  #load(song: LegacyOverlaySong): Loaded {
    return this.#loaded(song.generation);
  }

  async #openIfs(input: LegacyOverlayInput): Promise<TileOf | null> {
    const ifs = input.ifs;
    if (ifs === null) return null;
    return openIfs(
      await this.#repacker.read({
        archive: ifs.archive,
        generation: input.generation,
        sourceOffset: ifs.offset,
        sourceSize: ifs.size,
      }),
    );
  }
}
