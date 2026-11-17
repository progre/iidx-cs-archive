// 1曲を読むときに共有する値と、通し番号の補正。

import type { ArchiveRule, ElfDefinition } from "@csa/core";
import type { Entries } from "./entries.ts";
import type { SongmapRule } from "../types.ts";

export const NO_FILE_16 = 0xffff;
export const NO_FILE_32 = 0xffffffff;

const slotOf = (label: string) => label.toLowerCase().replace(" ", "_");
const labelOf = (slot: string) => slot.toUpperCase().replace("_", " ");

export interface SlotNames {
  chart: string | null;
  sounds: string | null;
  bgm: string | null;
  level: number | number[] | null;
}

export interface SongMeta {
  songId: number;
  title: string;
  charts: Map<string, SlotNames>;
  videos: string[];
  overlay: string | null;
}

export interface Context {
  def: ElfDefinition;
  elfLength: number;
  entries: Entries;
  rule: SongmapRule;
}

/** 曲DBのファイル番号を、通し番号にする */
export function shiftOf(
  archiveRule: ArchiveRule | null,
  value: number,
  origin: number | null,
  { entries }: Context,
): number {
  switch (archiveRule) {
    case null:
      return value;
    case "origin": {
      const shifts = [0, entries.countOf(0), entries.countOf(1)];
      const shift = shifts[Math.max(origin ?? 0, 1) - 1];
      if (shift == null) {
        throw new RangeError(`出自の値が範囲外: ${origin}`);
      }
      return value + shift;
    }
    case "overlap": {
      const boundary = entries.countOf(1);
      return value >= boundary ? value + boundary : value;
    }
  }
}

/** 譜面の欄の並びを、ファイル名に書く`SP HYPER`の形で返す */
export const labelsOf = ({ rule }: Context): readonly string[] =>
  rule.chartSlots.map(labelOf);

export function namesOf(meta: SongMeta, label: string | undefined): SlotNames {
  const names = meta.charts.get(slotOf(label ?? ""));
  if (names == null) {
    throw new Error(`この世代に無い難易度の枠: ${label}`);
  }
  return names;
}
