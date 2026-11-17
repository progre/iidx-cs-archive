import type { ElfDefinition } from "@csa/core";
import { ArtworkView } from "./artwork.ts";
import { ChartView } from "./chart.ts";
import { OverlayView } from "./overlay.ts";
import { SelectionView } from "./selection.ts";
import { TitleView } from "./title.ts";
import { VideoView } from "./video.ts";

/**
 * 曲DBの1レコード。欄は定義に従って読み、定義に無い欄はnullを返す。
 * 渡されたバイト列はコピーせずビューで持ち、setterはそこへ直接書く
 */
export class SongDbRecord {
  readonly title: TitleView;
  readonly selection: SelectionView;
  readonly video: VideoView;
  readonly artwork: ArtworkView;
  readonly overlay: OverlayView;
  readonly chart: ChartView;

  constructor(
    private readonly raw: Uint8Array,
    def: ElfDefinition,
    /** レコードの外にある題名を読むためのELF全体。持たないならnull */
    elf: Uint8Array | null,
  ) {
    if (raw.length !== def.songDbRecordLength) {
      throw new Error(
        `レコード長が合わない: 定義は${def.songDbRecordLength}、` +
          `バイト列は${raw.length}`,
      );
    }
    const layout = def.songDbRecordLayout;
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    this.title = new TitleView(view, layout.title, elf, def.pointerBase);
    this.selection = new SelectionView(view, layout.selection);
    this.video = new VideoView(view, layout.video);
    this.artwork = new ArtworkView(view, layout.artwork);
    this.overlay = new OverlayView(view, layout.overlay);
    this.chart = new ChartView(view, layout.chart);
  }

  /** ELFの曲DBへ書き込むためのバイト列。元のELFとは共有しない */
  serialize(): Uint8Array {
    return this.raw.slice();
  }
}
