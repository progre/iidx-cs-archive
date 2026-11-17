import type { VideoLayout } from "@csa/core";
import {
  readAll,
  readInt16,
  readUint,
  required,
  writeAll,
  writeInt16,
  writeUint,
} from "./data_view.ts";

export class VideoView {
  constructor(
    private readonly view: DataView,
    private readonly layout: VideoLayout,
  ) {}

  get primary(): number[] {
    const { primary } = this.layout;
    return readAll(this.view, primary, primary.bytes);
  }

  set primary(value: number[]) {
    const { primary } = this.layout;
    writeAll(this.view, primary, primary.bytes, value);
  }

  get secondary(): number[] | null {
    const { secondary } = this.layout;
    return secondary == null
      ? null
      : readAll(this.view, secondary, secondary.bytes);
  }

  get movieLead(): number | null {
    const offset = this.layout.movieLeadOffset;
    return offset == null ? null : readInt16(this.view, offset);
  }

  set movieLead(value: number) {
    const offset = required(this.layout.movieLeadOffset, "movieLead");
    writeInt16(this.view, offset, value);
  }

  get unkPb62(): number | null {
    const offset = this.layout.unkPb62Offset;
    return offset == null ? null : readUint(this.view, offset, 1);
  }

  set unkPb62(value: number) {
    const offset = required(this.layout.unkPb62Offset, "unkPb62");
    writeUint(this.view, offset, 1, value);
  }

  get secondaryArchive(): number | null {
    const offset = this.layout.secondaryArchiveOffset;
    return offset == null ? null : readUint(this.view, offset, 2);
  }

  get movieCountIn(): number | null {
    const offset = this.layout.movieCountInOffset;
    return offset == null ? null : readInt16(this.view, offset);
  }
}
