// 曲DBの1曲が使うムービーと曲中オーバーレイを、ファイルの一覧に書き込む。

import {
  type Context,
  NO_FILE_16,
  NO_FILE_32,
  shiftOf,
  type SongMeta,
} from "./context.ts";
import type { SongmapRecord } from "../types.ts";

export function readVideos(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  const { def, rule } = ctx;
  const archiveRule = def.songDbRecordLayout.video.archiveRule;
  const origin = record.selection.origin;
  const refer = (value: number, name: string) => {
    const serial = shiftOf(archiveRule, value, origin, ctx);
    ctx.entries.refer(serial, { songId: meta.songId, name });
    meta.videos.push(name);
  };
  const referAll = (values: readonly number[]) => {
    values.forEach((value, position) => {
      if (value === NO_FILE_16) {
        return;
      }
      const same = values.findIndex((other, i) =>
        i !== position && other === value
      );
      refer(value, `${meta.title} [${same < 0 ? position : same}].mpg`);
    });
  };
  const primary = record.video.primary;
  const secondary = record.video.secondary ?? [];
  const first = primary.at(0) ?? NO_FILE_16;
  switch (rule.videoPlan) {
    case "derived":
      return referAll(first === NO_FILE_16 ? [first] : [first, first + 1]);
    case "secondaryThenPrimary":
      return referAll([secondary.at(0) ?? NO_FILE_16, first]);
    case "primary":
      return referAll([first]);
    case "firstWithTwin": {
      if (first === NO_FILE_16) {
        return;
      }
      const twin = primary.findIndex((other, i) => i !== 0 && other === first);
      refer(first, `${meta.title} [${Math.max(twin, 0)}].mpg`);
      // 2本目の0は、ムービーが無い印である。PBは0でないときだけ2本目を流す(`0x1DEE40`)
      const second = primary.at(1) ?? NO_FILE_16;
      if (second !== first && second !== NO_FILE_16 && second !== 0) {
        refer(second, `${meta.title} [1].mpg`);
      }
      return;
    }
    case "mainThenPrimary": {
      const main = secondary.at(0) ?? NO_FILE_32;
      if (main !== NO_FILE_32) {
        refer(main, `${meta.title}.mpg`);
      }
      return referAll(primary);
    }
  }
}

export function readOverlay(
  record: SongmapRecord,
  meta: SongMeta,
  ctx: Context,
) {
  const value = record.overlay.file;
  if (value == null || value === NO_FILE_16 || value === 0) {
    return;
  }
  const archiveRule = ctx.def.songDbRecordLayout.overlay.archiveRule;
  const serial = shiftOf(archiveRule, value, record.selection.origin, ctx);
  meta.overlay = `${meta.title}.if`;
  ctx.entries.refer(serial, { songId: meta.songId, name: meta.overlay });
}
