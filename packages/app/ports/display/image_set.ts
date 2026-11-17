// 画像セットの組み立てへ、他の feature の実装を渡す。

import { imageSetOps } from "@csa/containers-if-container";
import {
  displayLayout,
  hasDisplayAssets,
  indexSheet,
  loadTextStyles,
  readSourceTitleRefs,
  renderTextImage,
} from "@csa/contents-display";
import {
  data1TocRow,
  PB_TOC_COUNT,
  PB_TOC_FILE_OFFSET,
} from "@csa/contents-elf";
import {
  buildImageSets as buildSets,
  type ImageSetBuild,
  type ImageSetLap,
  type ImageSetLapInput,
  type ImageSetPorts,
  readImageSetLap,
  type TitleImageSetInput,
} from "@csa/layout-image-set";
import type { IfPackage, OpenDisc } from "@csa/core";
import { elfDefinitionOf } from "@csa/selection-definitions";
import { catalogRowAt, catalogRowsOf, openSongDb } from "../song/mod.ts";

const FONT_DIRECTORY = "data/fonts";
const TEXT_STYLES_FILE = "data/text_styles.toml";

interface Types {
  disc: OpenDisc;
  elf: Uint8Array;
  package: IfPackage;
  part: Uint8Array;
  pb: { readAt(offset: number, length: number): Promise<Uint8Array> };
}

const ports: ImageSetPorts<Types> = {
  catalogRowAt,
  catalogRowsOf,
  displayLayout,
  hasDisplayAssets,
  openTextRenderer: async () => {
    const styles = await loadTextStyles(TEXT_STYLES_FILE);
    return (segments, kind) =>
      renderTextImage(segments, styles[kind], FONT_DIRECTORY);
  },
  ops: imageSetOps({
    indexSheet,
    pbTocFileOffset: PB_TOC_FILE_OFFSET,
    tocRowOf: data1TocRow,
  }),
  pbTocCount: PB_TOC_COUNT,
  sourceTitleRefsOf: (generation, elf, songIndex) =>
    readSourceTitleRefs(
      elf,
      openSongDb(generation, elf).offsetOf(songIndex),
      displayLayout(generation),
      elfDefinitionOf(generation).songDbRecordLayout.artwork,
    ),
};

export const buildImageSets = (
  input: TitleImageSetInput<Types>,
): Promise<ImageSetBuild> => buildSets(ports, input);

export const readImageSetLapOf = (
  input: ImageSetLapInput<Types>,
): Promise<ImageSetLap> => readImageSetLap(ports, input);
