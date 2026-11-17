// セクター単位でしか読めない装置を、任意の位置から読める原盤として見せる。

import { type DiscImage, SEC } from "@csa/core";
import { volumeSectorsOf } from "../../volume/mod.ts";

/** ドライブの読み出しは、位置も長さもセクターの倍数でなければならない */
export interface SectorDevice {
  /** `buffer`の長さ分を読む。`buffer`の長さはセクターの倍数である */
  readSectors(firstSector: number, buffer: Uint8Array): Promise<void>;
  close(): void;
}

const PVD_SECTOR = 16;

export class SectorDiscImage implements DiscImage {
  private constructor(
    private readonly device: SectorDevice,
    readonly size: number,
  ) {}

  /**
   * 大きさはPVDのセクター数から決める。ドライブの`stat`は使わない。
   * どの世代のイメージファイルでも、この値はファイルの大きさと一致した。
   */
  static async open(device: SectorDevice): Promise<SectorDiscImage> {
    const pvd = new Uint8Array(SEC);
    await device.readSectors(PVD_SECTOR, pvd);
    return new SectorDiscImage(device, volumeSectorsOf(pvd) * SEC);
  }

  async readAt(offset: number, length: number): Promise<Uint8Array> {
    const buffer = new Uint8Array(length);
    await this.readInto(offset, buffer);
    return buffer;
  }

  async readInto(offset: number, buffer: Uint8Array): Promise<void> {
    const end = offset + buffer.length;
    const first = Math.floor(offset / SEC);
    const last = Math.ceil(end / SEC);
    const lead = offset - first * SEC;
    if (lead === 0 && end === last * SEC) {
      await this.device.readSectors(first, buffer);
      return;
    }
    const sectors = new Uint8Array((last - first) * SEC);
    await this.device.readSectors(first, sectors);
    buffer.set(sectors.subarray(lead, lead + buffer.length));
  }

  close(): void {
    this.device.close();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}
