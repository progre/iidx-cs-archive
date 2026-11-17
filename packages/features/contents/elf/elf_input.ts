// manifestと配置計画から、CSAのELFを作る関数の入力を組む。
// 曲DBの枠1つを1件にする。
// 素材のパスも表示する曲名も持ち込まない。
// 値の決定と欄のバイト列は、呼び出し側が`ports`で渡す。

import type { IndividualAssetManifest, TitleSpriteRef } from "@csa/core";
import type { EntryFormat } from "./data/content/mod.ts";
import type {
  AssetPlacement,
  CsaElfInput,
  FolderNameImages,
  OverlayFields,
  PairlessSong,
  PbLevelField,
  SongCapacity,
  SongContent,
  SongEntry,
} from "./model/mod.ts";

/** 曲DBの枠1つぶんの入力のうち、配置計画から決まる部分 */
export type ElfSongParts<Overlay, IndexOf> =
  & Omit<SongEntry, "overlayFields">
  & {
    /** 曲DBへ書く前に欄を消す譜面の難易度名 */
    excludedCharts: readonly string[];
    overlay: Overlay;
    overlayIndexOf: IndexOf;
    /** 音とオーバーレイを共有するPB原盤の曲index */
    sharedWith: number | undefined;
  };

/** `Plan`は配置計画で、中身は`ports`だけが読む */
export interface CsaElfPorts<Plan, Overlay, IndexOf> {
  assertPlanMatchesManifest: (
    manifest: IndividualAssetManifest,
    plan: Plan,
  ) => void;
  elfContentOf: (
    manifest: IndividualAssetManifest,
    songs: SongEntry[],
    pairless: PairlessSong[],
  ) => Omit<SongContent, "pbBacks" | "pbLevels" | "pbVersions">;
  elfPlacementOf: (plan: Plan) => Omit<AssetPlacement, "addedFolderNames">;
  elfSongPartsOf: (
    manifest: IndividualAssetManifest,
    plan: Plan,
    songSprites: ReadonlyMap<number, TitleSpriteRef[]>,
  ) => ElfSongParts<Overlay, IndexOf>[];
  encodePbOverlay: (overlay: Overlay, indexOf: IndexOf) => OverlayFields;
  entryFormat: EntryFormat;
  /** PB原盤のエントリーの写しに全曲リストの難易度を書き、書いた後のレベル欄を取り出す */
  levelFieldsOf: (
    pbElf: Uint8Array,
    songIndex: number,
    levels: Readonly<Record<string, number>>,
  ) => PbLevelField["levels"];
  pairlessSongsOf: (
    manifest: IndividualAssetManifest,
    plan: Plan,
    sourceElfOf: (generation: string) => Uint8Array,
  ) => PairlessSong[];
  /** 全曲リストの`share`に書いたPB原盤の曲から、オーバーレイの欄を値を変えずに写す */
  pbOverlayFieldsOf: (pbElf: Uint8Array, songIndex: number) => OverlayFields;
  /** 全曲リストで外した譜面は、選曲画面がこの欄を見て出さない */
  withoutChartFields: (
    entry: Uint8Array,
    excludedCharts: readonly string[],
  ) => Uint8Array;
}

export interface CsaElfInputSource<Plan> {
  capacity: SongCapacity;
  /** 追加フォルダーの名前の画像 */
  folderNames?: FolderNameImages;
  /** 素材を整えた後のmanifest。資産の大きさが配置計画と揃っている */
  manifest: IndividualAssetManifest;
  plan: Plan;
  /** 曲DBの画像セット参照。曲名カードのある曲だけが対象になる。 */
  songSprites: ReadonlyMap<number, TitleSpriteRef[]>;
  /** 素材世代の抽出元ELFを引く。組を持たない曲の記述子の読み出しに使う */
  sourceElfOf: (generation: string) => Uint8Array;
}

/** 曲に無い譜面へ難易度を書いていれば止める */
function pbLevelFieldsOf<Plan, Overlay, IndexOf>(
  { levelFieldsOf }: CsaElfPorts<Plan, Overlay, IndexOf>,
  manifest: IndividualAssetManifest,
  pbElf: () => Uint8Array,
): PbLevelField[] {
  return (manifest.pbLevels ?? []).map(({ levels, songIndex }) => {
    try {
      return { levels: levelFieldsOf(pbElf(), songIndex, levels), songIndex };
    } catch (cause) {
      throw new Error(`pb song${songIndex}`, { cause });
    }
  });
}

export function ubElfInput<Plan, Overlay, IndexOf>(
  ports: CsaElfPorts<Plan, Overlay, IndexOf>,
  source: CsaElfInputSource<Plan>,
): CsaElfInput {
  const { capacity, manifest, plan, songSprites, sourceElfOf } = source;
  ports.assertPlanMatchesManifest(manifest, plan);
  const songs: SongEntry[] = ports.elfSongPartsOf(manifest, plan, songSprites)
    .map((
      { entry, excludedCharts, overlay, overlayIndexOf, sharedWith, ...fields },
    ) => ({
      ...fields,
      entry: ports.withoutChartFields(entry, excludedCharts),
      overlayFields: sharedWith === undefined
        ? ports.encodePbOverlay(overlay, overlayIndexOf)
        : ports.pbOverlayFieldsOf(sourceElfOf("pb"), sharedWith),
    }));
  const pbLevels = pbLevelFieldsOf(ports, manifest, () => sourceElfOf("pb"));
  return {
    capacity,
    content: {
      ...ports.elfContentOf(
        manifest,
        songs,
        ports.pairlessSongsOf(manifest, plan, sourceElfOf),
      ),
      ...(pbLevels.length === 0 ? {} : { pbLevels }),
      ...(manifest.pbBacks === undefined ? {} : { pbBacks: manifest.pbBacks }),
      ...(manifest.pbVersions === undefined
        ? {}
        : { pbVersions: manifest.pbVersions }),
    },
    entryFormat: ports.entryFormat,
    placement: {
      ...ports.elfPlacementOf(plan),
      addedFolderNames: source.folderNames,
    },
  };
}
