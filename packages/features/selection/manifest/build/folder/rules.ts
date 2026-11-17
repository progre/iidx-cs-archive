// 曲へ書く作品番号を決める唯一の場所。規則は6つで、
// `versionOf`がその順に並んでいる。

import type { CarriedSong, FolderCarry } from "./carry.ts";

/** 全曲リストの`folder`列が指定した作品番号。キーは`folderOverrideKey`で作る */
export type FolderOverrides = ReadonlyMap<string, number>;

/**
 * 全曲リストの行番号を持つ曲は、その行の指定を使う。同じ曲を2行に書いた曲は、行ごとに指定が違うことがある。
 * 行番号を持たない曲は、曲番号で引く
 */
export const folderOverrideKey = (
  generation: string,
  songId: number,
  line?: number,
): string =>
  line === undefined ? generation + ":" + songId : generation + "@" + line;

/** 作品番号を求める関数の組。実体は、曲DBの形式を扱うパッケージが定義する */
export interface VersionTables {
  /** 枠の略号から作品番号 */
  folderVersion(folderName: string): number;
  /** 新旧の印から決まる作品番号。決まらなければ`undefined` */
  markedVersion(generation: string, mark: number): number | undefined;
  /** PB原盤の素材の値から作品番号 */
  pbVersion(version: number, songId: number): number;
  /** 素材の作品番号をCSAの並びへ直した値 */
  sourceVersionToCsa(generation: string, version: number): number;
  /** 印の無い曲の既定の作品番号 */
  unmarkedVersion(generation: string, mark: number | undefined): number;
}

function fail(message: string): never {
  throw new Error(message);
}

/** 引き継ぎ元から、`version`を使う`generation`を1つ除く */
function withoutGeneration(
  versions: ReadonlyMap<number, string[]>,
  version: number,
  generation: string,
): ReadonlyMap<number, string[]> {
  const generations = versions.get(version) ?? [];
  const index = generations.indexOf(generation);
  if (index < 0) {
    return versions;
  }
  const rest = generations.toSpliced(index, 1);
  const out = new Map(versions);
  if (rest.length === 0) {
    out.delete(version);
  } else {
    out.set(version, rest);
  }
  return out;
}

export interface FolderRules {
  /**
   * 全曲リストの`folder`列で指定した曲について、指定が無ければ規則2〜6が決める作品番号。
   * 指定の無い曲は`undefined`、規則3で引き継ぎ元が食い違う曲は`null`を返す
   */
  overriddenFrom(row: CarriedSong): number | null | undefined;
  versionOf(row: CarriedSong): number;
}

type SameName = { version: number } | { conflict: string } | undefined;

/** 引き継ぎ索引は全世代のELFを読むので、規則3へ来る曲が現れるまで作らない */
export function newFolderRules(
  overrides: FolderOverrides,
  tables: VersionTables,
  loadCarry: (
    versionOf: (row: CarriedSong) => number | undefined,
  ) => FolderCarry,
  loadThirdOld: () => ReadonlySet<string>,
): FolderRules {
  const firstStyle = tables.folderVersion("1st");
  const secondStyle = tables.folderVersion("2nd");

  /** 規則1 */
  const fromTable = (
    { catalogLine, sourceGeneration, sourceSongIndex }: CarriedSong,
  ) =>
    overrides.get(
      folderOverrideKey(sourceGeneration, sourceSongIndex, catalogLine),
    );

  /**
   * 規則2。原盤は曲DB indexで作品番号1を1st styleとsubstreamへ分けているので、その値を採れる。
   * 他の世代の1は、1st styleとsubstreamのどちらなのか分けられていない。そのため採らず、規則4へ送る。
   */
  const fromSource = (
    {
      newOld,
      sourceGeneration: generation,
      sourceSongIndex: songId,
      sourceVersion,
    }: CarriedSong,
  ) => {
    if (sourceVersion !== undefined) {
      if (generation === "pb") {
        return tables.pbVersion(sourceVersion, songId);
      }
      const version = tables.sourceVersionToCsa(generation, sourceVersion);
      if (version !== firstStyle) {
        return version;
      }
    }
    return newOld === undefined
      ? undefined
      : tables.markedVersion(generation, newOld);
  };

  /** 規則3が読む「同じ管理名の曲の値」は、規則1と規則2がその曲に決めた値である */
  const knownVersion = (row: CarriedSong) => fromTable(row) ?? fromSource(row);

  let carry: FolderCarry | undefined;
  let thirdOld: ReadonlySet<string> | undefined;

  /**
   * 規則3。`self`には、この曲に規則1が決めた作品番号を渡す。
   * 渡した値は、引き継ぎ元の値から除く
   */
  const sameNameOf = (
    { canonicalKey, sourceGeneration: generation }: CarriedSong,
    self?: number,
  ): SameName => {
    carry ??= loadCarry(knownVersion);
    const found = carry.get(canonicalKey);
    const versions = found === undefined || self === undefined
      ? found
      : withoutGeneration(found, self, generation);
    if (versions === undefined || versions.size === 0) {
      return undefined;
    }
    if (versions.size > 1) {
      const found = [...versions].map(([version, generations]) =>
        `${version}(${generations.join("・")})`
      ).join(" / ");
      return {
        conflict:
          `${canonicalKey}の作品番号が引き継ぎ元で食い違う: ${found}。` +
          "全曲リストのfolder列で指定する",
      };
    }
    return { version: [...versions.keys()][0] };
  };

  const fromSameName = (row: CarriedSong) => {
    const found = sameNameOf(row);
    if (found === undefined) {
      return undefined;
    }
    return "conflict" in found ? fail(found.conflict) : found.version;
  };

  /** 規則4。ここへ来る素材の値は、規則2が採らなかった1st styleの値だけである */
  const fromFirstStyle = ({ sourceVersion }: CarriedSong) =>
    sourceVersion === undefined ? undefined : firstStyle;

  /** 規則5 */
  const fromThirdOld = ({ canonicalKey }: CarriedSong) => {
    thirdOld ??= loadThirdOld();
    return thirdOld.has(canonicalKey) ? secondStyle : undefined;
  };

  /** 規則4〜6 */
  const fromRest = (row: CarriedSong) =>
    fromFirstStyle(row) ??
      fromThirdOld(row) ??
      tables.unmarkedVersion(row.sourceGeneration, row.newOld);

  return {
    overriddenFrom: (row) => {
      const override = fromTable(row);
      if (override === undefined) {
        return undefined;
      }
      const source = fromSource(row);
      if (source !== undefined) {
        return source;
      }
      const sameName = sameNameOf(row, override);
      if (sameName === undefined) {
        return fromRest(row);
      }
      return "conflict" in sameName ? null : sameName.version;
    },
    versionOf: (row) =>
      fromTable(row) ??
        fromSource(row) ??
        fromSameName(row) ??
        fromRest(row),
  };
}
