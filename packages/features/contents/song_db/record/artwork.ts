import type { ArtworkLayout } from "@csa/core";
import {
  type Pair,
  readPairs,
  readUint,
  required,
  writePairs,
  writeUint,
} from "./data_view.ts";

export class ArtworkView {
  constructor(
    private readonly view: DataView,
    private readonly layout: ArtworkLayout,
  ) {}

  get genre(): number | null {
    const offset = this.layout.genreOffset;
    return offset == null ? null : readUint(this.view, offset, 2);
  }

  get bigTitle(): number | null {
    const offset = this.layout.bigTitleOffset;
    return offset == null ? null : readUint(this.view, offset, 2);
  }

  get artist(): number | null {
    const offset = this.layout.artistOffset;
    return offset == null ? null : readUint(this.view, offset, 2);
  }

  get titleCard(): number {
    const { offset, bytes } = this.layout.titleCard;
    return readUint(this.view, offset, bytes);
  }

  set titleCard(value: number) {
    const { offset, bytes } = this.layout.titleCard;
    writeUint(this.view, offset, bytes, value);
  }

  get titleCardPairs(): Pair[] | null {
    const slots = this.layout.titleCardPairs;
    return slots == null ? null : readPairs(this.view, slots);
  }

  set titleCardPairs(value: Pair[]) {
    const slots = required(this.layout.titleCardPairs, "titleCardPairs");
    writePairs(this.view, slots, value);
  }

  get imageSet(): Pair[] | null {
    const slots = this.layout.imageSet;
    return slots == null ? null : readPairs(this.view, slots);
  }

  set imageSet(value: Pair[]) {
    const slots = required(this.layout.imageSet, "imageSet");
    writePairs(this.view, slots, value);
  }

  get unkPbBc(): number | null {
    const offset = this.layout.unkPbBcOffset;
    return offset == null ? null : readUint(this.view, offset, 4);
  }

  set unkPbBc(value: number) {
    const offset = required(this.layout.unkPbBcOffset, "unkPbBc");
    writeUint(this.view, offset, 4, value);
  }
}
