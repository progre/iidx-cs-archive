// 素材のDATA1にある`.if`を、記述子を`+8`へ揃えて`<discs>/<世代>/<種類>/NNNN.if`へ1本ずつ書き出す。
// 曲名カードと曲中オーバーレイが同じ経路を通る。周回の中で呼び、前のビルドのファイルがあっても毎回原盤から読んで書く。
import { type DescriptorStart, type OpenDisc, SEC } from "@csa/core";
import { normalizeIfDescriptors } from "./format/mod.ts";
import { writeIfFile } from "./image_set/mod.ts";

interface OpenImage {
  disc: OpenDisc["disc"];
  lba: number;
}

/** 世代の周回で開いてある原盤。その世代の読み出しには、これを使う */
export interface LapDisc {
  disc: OpenDisc;
  generation: string;
}

export type IfFolder = "overlays" | "title_cards";

/** 周回で書く`.if`の置き場の決め方。実装は app が渡す */
export interface IfPlacePorts {
  assertIntermediateDirectory: (discsDirectory: string) => void;
  ifDirectoryOf: (
    discsDirectory: string,
    generation: string,
    folder: IfFolder,
  ) => string;
  ifFileNameOf: (fileIndex: number) => string;
  ifFilePathOf: (directory: string, name: string) => string;
}

/** DATA1以外に置かれた`.if`もあるので、読み手はアーカイブ名を選べる(3rd〜8th) */
const DATA1 = "DATA1.DAT";

export interface RepackInput {
  descriptorStart: DescriptorStart;
  fileIndex: number;
  generation: string;
  sourceOffset: number;
  sourceSize: number;
}

export interface Repacked {
  path: string;
  /** 原盤から読まず、この回に書いたファイルを使った */
  reused: boolean;
  size: number;
}

/** 周回の原盤から読む。原盤は周回から借りるので、閉じない。使い終わったら`close`する */
export class IfRepacker {
  readonly #images = new Map<string, OpenImage>();
  readonly #lap: LapDisc;
  readonly #paths = new Set<string>();
  readonly #places: IfPlacePorts;
  readonly #discsDirectory: string;
  readonly #folder: IfFolder;
  readonly #sizes = new Map<string, number>();
  readonly #adjust: (bytes: Uint8Array) => Uint8Array;

  /**
   * `.if`は、世代のフォルダーの下の`folder`に書く。`folder`の名前は、曲名カードかオーバーレイかを表す。
   * `adjust`は、記述子を揃えた後、書く前に中身を整える
   */
  constructor(
    places: IfPlacePorts,
    discsDirectory: string,
    folder: IfFolder,
    lap: LapDisc,
    adjust: (bytes: Uint8Array) => Uint8Array = (bytes) => bytes,
  ) {
    this.#places = places;
    this.#lap = lap;
    this.#adjust = adjust;
    places.assertIntermediateDirectory(discsDirectory);
    this.#discsDirectory = discsDirectory;
    this.#folder = folder;
  }

  async repack(input: RepackInput): Promise<Repacked> {
    const directory = this.#places.ifDirectoryOf(
      this.#discsDirectory,
      input.generation,
      this.#folder,
    );
    const path = this.#places.ifFilePathOf(
      directory,
      this.#places.ifFileNameOf(input.fileIndex),
    );
    this.#paths.add(path);
    const known = this.#sizes.get(path);
    if (known !== undefined) {
      return { path, reused: true, size: known };
    }
    const open = this.#open(input.generation, DATA1);
    const bytes = this.#adjust(normalizeIfDescriptors(
      await open.disc.readAt(
        open.lba * SEC + input.sourceOffset,
        input.sourceSize,
      ),
      input.descriptorStart,
    ));
    writeIfFile(directory, path, bytes);
    this.#sizes.set(path, bytes.length);
    return { path, reused: false, size: bytes.length };
  }

  /** この回に書いたファイルの大きさ。書いていなければ`undefined` */
  writtenSize(path: string): number | undefined {
    return this.#sizes.get(path);
  }

  /** 別の経路で書いたファイルを、この回に書いたものとして覚える */
  record(path: string, size: number): void {
    this.#paths.add(path);
    this.#sizes.set(path, size);
  }

  /** 素材アーカイブの範囲をそのまま読む。並べ替えの要らない世代を分けるときに使う */
  async read(
    input: Omit<RepackInput, "descriptorStart" | "fileIndex"> & {
      archive?: string;
    },
  ): Promise<Uint8Array> {
    const open = this.#open(input.generation, input.archive ?? DATA1);
    return await open.disc.readAt(
      open.lba * SEC + input.sourceOffset,
      input.sourceSize,
    );
  }

  /** `repack`が書いたファイルと、`record`で覚えたファイル */
  paths(): string[] {
    return [...this.#paths];
  }

  close(): void {
    this.#images.clear();
  }

  #open(generation: string, archive: string): OpenImage {
    const key = `${generation}/${archive}`;
    const found = this.#images.get(key);
    if (found !== undefined) return found;
    if (this.#lap.generation !== generation) {
      throw new Error(
        `${generation}の原盤は開かない。素材は、その世代の周回の中で読む`,
      );
    }
    const lba = this.#lap.disc.files.get(archive.toUpperCase())?.lba;
    if (lba === undefined) {
      throw new Error(`${generation}に${archive}が無い`);
    }
    const open = { disc: this.#lap.disc.disc, lba };
    this.#images.set(key, open);
    return open;
  }
}
