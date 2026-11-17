// オーバーレイを組んで書く処理が使う、他の feature の関数。実装は app が渡す。

import type { Image } from "@csa/core";
import type { LegacyOverlay, OverlayScene } from "../../legacy_overlay/mod.ts";

export interface LegacyOverlayWritePorts {
  forCurrentGeneration: <T>(
    make: (generation: string) => T,
  ) => (generation: string) => T;
  ifDirectoryOf: (
    discsDirectory: string,
    generation: string,
    folder: "overlays",
  ) => string;
  ifFilePathOf: (directory: string, name: string) => string;
  openLegacyOverlay: (generation: string, elf: Uint8Array) => LegacyOverlay;
  /** 絵をシートへ焼く。`fits`は上限に収まったかを示す。`packageOf`は場面から`.if`を組む */
  packOverlay: (images: Image[]) => {
    fits: boolean;
    packageOf: (scenes: readonly OverlayScene[]) => Uint8Array;
    sheets: number;
  };
  padToSector: (bytes: Uint8Array) => Uint8Array;
  writeIfFile: (directory: string, path: string, bytes: Uint8Array) => void;
}
