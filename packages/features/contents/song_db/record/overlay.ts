import type { OverlayLayout, SizedSlots } from "@csa/core";
import {
  type Pair,
  readAll,
  readPairs,
  readUint,
  required,
  writeAll,
  writePairs,
} from "./data_view.ts";

export class OverlayView {
  constructor(
    private readonly view: DataView,
    private readonly layout: OverlayLayout,
  ) {}

  get packages(): number[] | null {
    const { packages } = this.layout;
    return packages == null ? null : readAll(this.view, packages, 2);
  }

  set packages(value: number[]) {
    const slots = required(this.layout.packages, "packages");
    writeAll(this.view, slots, 2, value);
  }

  get pairs(): Pair[] | null {
    const { pairs } = this.layout;
    return pairs == null ? null : readPairs(this.view, pairs);
  }

  set pairs(value: Pair[]) {
    writePairs(this.view, required(this.layout.pairs, "pairs"), value);
  }

  /** 枠ごとのu16の並び */
  get slots(): number[][] | null {
    const { slots } = this.layout;
    return slots == null
      ? null
      : Array.from({ length: slots.count }, (_, i) => this.slotAt(slots, i));
  }

  get file(): number | null {
    const offset = this.layout.fileOffset;
    return offset == null ? null : readUint(this.view, offset, 2);
  }

  private slotAt(slots: SizedSlots, index: number): number[] {
    const offset = slots.offset + index * slots.bytes;
    return readAll(this.view, { offset, count: slots.bytes / 2 }, 2);
  }
}
