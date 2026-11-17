import type { SelectionLayout } from "@csa/core";
import {
  readAll,
  readUint,
  required,
  writeAll,
  writeUint,
} from "./data_view.ts";

export interface Bpm {
  min: number;
  max: number;
  first: number;
}

export class SelectionView {
  constructor(
    private readonly view: DataView,
    private readonly layout: SelectionLayout,
  ) {}

  get others(): number | null {
    const { others } = this.layout;
    return others == null
      ? null
      : readUint(this.view, others.offset, others.bytes);
  }

  set others(value: number) {
    const { offset, bytes } = required(this.layout.others, "others");
    writeUint(this.view, offset, bytes, value);
  }

  get bpm(): Bpm | null {
    const { bpm } = this.layout;
    return bpm == null ? null : {
      min: readUint(this.view, bpm.minOffset, 2),
      max: readUint(this.view, bpm.maxOffset, 2),
      first: readUint(this.view, bpm.firstOffset, 2),
    };
  }

  set bpm(value: Bpm) {
    const bpm = required(this.layout.bpm, "bpm");
    writeUint(this.view, bpm.minOffset, 2, value.min);
    writeUint(this.view, bpm.maxOffset, 2, value.max);
    writeUint(this.view, bpm.firstOffset, 2, value.first);
  }

  get beginnerLevel(): number | null {
    const offset = this.layout.beginnerLevelOffset;
    return offset == null ? null : readUint(this.view, offset, 1);
  }

  get levels(): number[] {
    return readAll(this.view, this.layout.levels, 1);
  }

  set levels(value: number[]) {
    writeAll(this.view, this.layout.levels, 1, value);
  }

  /** 定義のisVersionで、ACの作品番号か新旧の印かが決まる */
  get origin(): number | null {
    const { origin } = this.layout;
    return origin == null
      ? null
      : readUint(this.view, origin.offset, origin.bytes);
  }

  set origin(value: number) {
    const { offset, bytes } = required(this.layout.origin, "origin");
    writeUint(this.view, offset, bytes, value);
  }
}
