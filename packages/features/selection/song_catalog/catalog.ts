// 全世代の全曲リストを読み、組を作るためのキーと、原作の5鍵盤版の見分け方を持つ。
// 世代の全曲リストは、曲DBの曲番号から行を引く表にもする。

import type { CatalogFiveKey, CatalogRow, CatalogVariant } from "@csa/core";
import {
  catalogFileNames,
  parseSongCatalog,
  readCatalogFile,
} from "./file/mod.ts";
import { rowsBySongId } from "./levels/writing/mod.ts";
import {
  catalogFiveKeysOf,
  catalogVariantsOf,
  type FrontChooser,
  type GenerationCatalog,
  type IsFiveKeyTwin,
  ownerAsFront,
  type SaveSlots,
  saveSlotsOf,
  type SongKeyOf,
  withGroupSubtitles,
} from "./file/groups/mod.ts";
import { matchSongCatalog } from "./match.ts";
import { generationOfCatalogFile } from "./review.ts";

/** `Elf`は世代の曲DBを持つ実行ファイルである。中身は`songsOf`だけが読む */
export interface SongCatalogPorts<Elf> {
  /** `songId`が原作の5鍵盤版なら、その表の曲の曲番号を返す */
  fiveKeyOf: (generation: string, songId: number) => number | undefined;
  /** 原盤を読む世代なら真。読まない世代の全曲リストは、組に入れない */
  isRead: (generation: string) => boolean;
  /** 曲DBの曲番号と管理名。定義の無い世代なら例外にする */
  songsOf: (
    generation: string,
    elf: Elf,
  ) => { songId: number; title: string }[];
  /** 世代をまたぐ曲の索引のキー */
  titleKeyOf: (title: string) => string;
}

/**
 * us の管理名は、頭に`<表示順> <内部番号>_`が付く。
 * 曲の索引の us の題名には付かないので、除いてからキーを作る
 */
const US_INDEX_PREFIX = /^\d+ \d+_/;

/**
 * 原盤を読む世代の全曲リストを読む。ファイル名は`<連番>_<世代>.csv`なので、名前の順が世代の順になる。
 * 読まない世代の行は、組の表や裏にできないので読まない
 */
const allCatalogs = (
  isRead: (generation: string) => boolean,
): GenerationCatalog[] =>
  catalogFileNames().toSorted().flatMap((name) => {
    const generation = generationOfCatalogFile(name);
    return generation === undefined || !isRead(generation)
      ? []
      : [{ generation, rows: parseSongCatalog(readCatalogFile(name)) }];
  });

export function songCatalog<Elf>(
  { fiveKeyOf, isRead, songsOf, titleKeyOf }: SongCatalogPorts<Elf>,
) {
  const readCatalogs = () => allCatalogs(isRead);
  /** 同じ曲は、世代をまたぐ曲の索引のキーで見分ける */
  const songKeyOf: SongKeyOf = (generation, { indexTitle, name }) =>
    titleKeyOf(
      indexTitle ??
        (generation === "us" ? name.replace(US_INDEX_PREFIX, "") : name),
    );

  /** 原作の5鍵盤版は、全曲リストに曲番号付きで書いた行で見分ける */
  const isFiveKeyTwin: IsFiveKeyTwin = (generation, { songId }) =>
    songId !== null && fiveKeyOf(generation, songId) !== undefined;

  /**
   * 組の表の選び方。表の曲を選ぶ材料(原盤の素材)は周回の後にそろうので、それまでは枠の持ち主を表にする。
   * 表の行が変わると副題の付く行も変わるので、選び方を替えたら副題を寄せ直す
   */
  let chooseFront: FrontChooser = ownerAsFront;

  /** 全曲リストはビルドの間に変わらないので、曲indexの表は1回だけ作る */
  let slots: SaveSlots | undefined;

  /** 組の副題を表の行に寄せた、全世代の全曲リスト。全曲リストはビルドの間に変わらないので、選び方ごとに1回だけ読む */
  let grouped: GenerationCatalog[] | undefined;
  const groupedCatalogs = (): GenerationCatalog[] =>
    grouped ??= withGroupSubtitles(
      readCatalogs(),
      songKeyOf,
      isFiveKeyTwin,
      chooseFront,
    );

  /** `elf`は世代の曲DBを持つELFである。リストの行を、曲DBの管理名と照合する */
  const catalogMatchOf = (generation: string, elf: Elf) => {
    const file = catalogFileNames()
      .find((name) => generationOfCatalogFile(name) === generation);
    if (file == null) {
      throw new Error(`${generation}の全曲リストか定義が無い`);
    }
    const songs = songsOf(generation, elf);
    // 組の副題は、表の曲の行に寄せてから使う
    const rows =
      groupedCatalogs().find((c) => c.generation === generation)?.rows ??
        parseSongCatalog(readCatalogFile(file));
    return matchSongCatalog([...rows], songs);
  };

  return {
    /**
     * 全曲リストに同じ曲を2行以上書いた曲について、2行目以降の行を曲番号ごとに返す。
     * 返すのは、前の行と`index_title`が違う行に限る
     */
    catalogCopiesOf: (
      generation: string,
      elf: Elf,
    ): Map<number, CatalogRow[]> => {
      const copies = catalogMatchOf(generation, elf).copies;
      return new Map(
        [...Map.groupBy(copies, ({ song }) => song.songId)].map((
          [songId, matches],
        ) => [songId, matches.map(({ row }) => row)]),
      );
    },
    /** 全曲リストに書いた5鍵盤版の組 */
    catalogFiveKeys: (): CatalogFiveKey[] =>
      catalogFiveKeysOf(readCatalogs(), songKeyOf, isFiveKeyTwin, chooseFront),
    /**
     * 曲が全曲リストに書かれた行。同じ曲を2行に書いた曲は、行ごとに曲名やフォルダーが違うので、曲番号でなく行番号で引く。
     * 行番号を持たない曲は`undefined`である
     */
    catalogRowAt: (
      generation: string,
      line: number | undefined,
    ): CatalogRow | undefined => {
      if (line === undefined) {
        return undefined;
      }
      return groupedCatalogs()
        .find((catalog) => catalog.generation === generation)
        ?.rows.find((row) => row.line === line);
    },
    /** リストの行を曲番号に結ぶ。同じ曲を指す行が2つ以上あれば、1行目を結ぶ */
    catalogRowsOf: (generation: string, elf: Elf): Map<number, CatalogRow> =>
      rowsBySongId(catalogMatchOf(generation, elf).matches),
    /** 全曲リストに書いた裏の組 */
    catalogVariants: (): CatalogVariant[] =>
      catalogVariantsOf(readCatalogs(), songKeyOf, isFiveKeyTwin, chooseFront),
    groupedCatalogs,
    /** 組の表の選び方を替える。替えた後に引く行は、新しい表の行に副題を寄せる */
    useFrontChooser: (chooser: FrontChooser): void => {
      chooseFront = chooser;
      grouped = undefined;
    },
    /**
     * 組のセーブの曲index。原盤を読む世代によらず、全世代の全曲リストから決める。
     * どの原盤の組み合わせで作っても、同じ曲を同じ曲indexに置くためである
     */
    saveSlots: (): SaveSlots =>
      slots ??= saveSlotsOf(allCatalogs(() => true), songKeyOf, isFiveKeyTwin),
  };
}
