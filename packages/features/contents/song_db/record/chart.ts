import type { ChartLayout } from "@csa/core";
import { readAll, required, writeAll } from "./data_view.ts";

export class ChartView {
  constructor(
    private readonly view: DataView,
    private readonly layout: ChartLayout,
  ) {}

  get files(): number[] {
    return readAll(this.view, this.layout.files, 4);
  }

  set files(value: number[]) {
    writeAll(this.view, this.layout.files, 4, value);
  }

  get sounds(): number[] {
    return readAll(this.view, this.layout.sounds, 2);
  }

  set sounds(value: number[]) {
    writeAll(this.view, this.layout.sounds, 2, value);
  }

  get anotherBgm(): number | null {
    const { anotherBgmOffset } = this.layout;
    return anotherBgmOffset == null
      ? null
      : this.view.getUint16(anotherBgmOffset, true);
  }

  get notes(): number[] | null {
    const { notes } = this.layout;
    return notes == null ? null : readAll(this.view, notes, 2);
  }

  set notes(value: number[]) {
    writeAll(this.view, required(this.layout.notes, "notes"), 2, value);
  }

  get unkPb126(): number[] | null {
    const { unkPb126 } = this.layout;
    return unkPb126 == null ? null : readAll(this.view, unkPb126, 2);
  }

  set unkPb126(value: number[]) {
    const slots = required(this.layout.unkPb126, "unkPb126");
    writeAll(this.view, slots, 2, value);
  }
}
