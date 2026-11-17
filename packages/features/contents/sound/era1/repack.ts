// era1 (3rd〜8th) のヘッダレス旧バンクをPB用 "wp" v3 へ再パックする。

import { cipherKeysoundChannel, encodeRate, isSilentFrame } from "../adpcm.ts";
import { WP_V3 } from "../form.ts";
import { FILE_TABLE, KS_TABLE_END } from "../keysound/mod.ts";
import { era1GroupsOf, era1LevelOf } from "./keysound/mod.ts";
import { type OldEntry, parseOld } from "./old_bank.ts";

/** keysound_entries の行数上限 (0x10〜0x8000 を16バイトで割る) */
const KS_TABLE_CAP = (KS_TABLE_END - 0x10) / 0x10;
/**
 * `gain_type0=92` / `gain_type1=80` (暫定。era1に元が無くPB公式変換ペアの統計値)。
 */
const GAIN_TYPE0 = 92;
const GAIN_TYPE1 = 80;
/** BGMの音量で鳴らすera1の音量の系統。PBのゲインの種別1が同じ音量の設定に従う */
const BGM_VOLUME_GROUP = 1;
/**
 * 表の先頭に置く、`file_id 0` を指す埋草行の数。sound_id 1/2 はエンジンの予約値で、
 * 実音を置くとBGMが曲の途中で張り直される。
 */
const LEAD_DUMMY = 2;

export interface Era1RepackOptions {
  /** 旧バンクの `entry_id` を保ち、譜面の `sound_id` を書き換えずに済ませる */
  keepEntryIds?: boolean;
  /** 原作のドライバーが、同じ番号の音の鳴らし直しで前の音を止める世代 */
  cutOnRetrigger?: boolean;
}

export interface Era1Repacked {
  bytes: Uint8Array;
  /** 旧 `entry_id` → 新 `entry_id`。譜面の `sound_id` を同じ写像で書き換える */
  soundMap: Record<string, number>;
}

/** 系統2以上は固定の音量で鳴るが、PBに同じ種別は無い。原盤にも現れない */
function gainTypeOf(e: OldEntry): number {
  if (e.volumeGroup > BGM_VOLUME_GROUP) {
    throw new Error(
      `entry_id ${e.entryId} の音量の系統 ${e.volumeGroup} はPBで表せない`,
    );
  }
  return e.volumeGroup;
}

/**
 * era1では系統1の音もキー音と同じ大きさの基準で鳴る。系統1を持つバンクだけ
 * `gain_type1` を `gain_type0` にそろえ、他は従来の値を保つ
 */
const gainType1Of = (entries: OldEntry[]) =>
  entries.some((e) => e.volumeGroup === BGM_VOLUME_GROUP)
    ? GAIN_TYPE0
    : GAIN_TYPE1;

/**
 * 発音枠が足りないときの優先度。原作のドライバーはu16を100で割った余りで比べる。
 * 百の位は、2人で遊ぶときの左右の音量を決める。優先度には使わない
 */
const priorityOf = (e: OldEntry) => ((e.unk03 << 8) | e.unk02) % 100;

const isZeroRow = (buf: Uint8Array, at: number) =>
  buf.subarray(at, at + 0x10).every((b) => b === 0);

/** duration_ms は符号化前の素材の公称レートで割る */
const durationMs = (e: OldEntry) =>
  Math.floor((e.size / 16) * 28 / e.rate1 * 1000);

function writeFillerRow(
  out: Uint8Array,
  dv: DataView,
  at: number,
  first: OldEntry,
  lead: boolean,
): void {
  out[at + 0x00] = priorityOf(first);
  out[at + 0x01] = first.unk04;
  dv.setUint16(at + 0x02, first.ch << 8, true);
  dv.setUint32(at + 0x04, lead ? durationMs(first) : 0, true);
  out[at + 0x08] = lead && first.ch === 2 ? 1 : 64;
  out[at + 0x09] = lead ? (first.ch === 2 ? 127 : 64) : 0;
  dv.setUint16(at + 0x0a, 0, true);
  dv.setUint32(at + 0x0c, 0, true);
}

export function repackEra1Keysound(
  oldBuf: Uint8Array,
  options: Era1RepackOptions = {},
): Era1Repacked {
  const entries = parseOld(oldBuf).entries;
  // 既定は公式と同じく 3 から連番に振り直す。旧 entry_id は曲ごとに開始値が違う
  const entryIds = options.keepEntryIds
    ? entries.map((e) => e.entryId)
    : entries.map((_, i) => i + 1 + LEAD_DUMMY);
  const maxId = Math.max(...entryIds);
  if (maxId > KS_TABLE_CAP) {
    throw new Error(`entry_id ${maxId} が表の容量 ${KS_TABLE_CAP} を超える`);
  }
  // 暗号鍵はデータ先頭フレームから導出される
  if (!isSilentFrame(oldBuf, entries[0].dataOffset)) {
    throw new Error(
      `先頭エントリ(entry_id ${
        entries[0].entryId
      })の先頭フレームが無音でない。` +
        "暗号鍵はここから導出されるため、このまま詰めると全体が鳴らない",
    );
  }

  const dataTotal = entries.reduce((a, e) => a + e.size * e.ch, 0);
  const dataOffset = FILE_TABLE + entries.length * 0x10;
  const out = new Uint8Array(dataOffset + dataTotal);
  const dv = new DataView(out.buffer);
  dv.setUint32(0x00, WP_V3, true);
  dv.setUint32(0x04, 0x10, true);
  out[0x08] = GAIN_TYPE0;
  const gainType1 = gainType1Of(entries);
  out[0x09] = gainType1;
  const groups = era1GroupsOf(
    entries.map((e) => e.unk04),
    options.cutOnRetrigger ?? false,
  );

  let cum = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const kp = 0x10 + (entryIds[i] - 1) * 0x10;
    if (!isZeroRow(out, kp)) {
      throw new Error(`entry_id ${entryIds[i]} が重複している`);
    }
    out[kp + 0x00] = priorityOf(e);
    out[kp + 0x01] = groups[i];
    dv.setUint16(kp + 0x02, (e.ch << 8) | gainTypeOf(e), true);
    dv.setUint32(kp + 0x04, durationMs(e), true);
    // BGMに対する左右の大きさが原作と同じになる定位と音量。
    // +0x09 はPB実物の慣習 (モノは +0x08 と同値、ステレオは (1, 127))
    const level = era1LevelOf(
      e,
      gainTypeOf(e) === BGM_VOLUME_GROUP ? gainType1 : GAIN_TYPE0,
    );
    out[kp + 0x08] = level.pan ?? 1;
    out[kp + 0x09] = level.pan ?? 127;
    dv.setUint16(kp + 0x0a, i, true);
    dv.setUint32(kp + 0x0c, level.volume, true);

    const fp = FILE_TABLE + i * 0x10;
    dv.setUint32(fp + 0x00, cum, true);
    dv.setUint32(fp + 0x04, e.size, true);
    dv.setUint16(fp + 0x08, e.ch, true);
    dv.setUint16(fp + 0x0a, encodeRate(e.rate1), true);
    dv.setUint32(fp + 0x0c, 0, true);

    // ステレオは左を全部書いてから右
    for (let ch = 0; ch < e.ch; ch++) {
      const at = dataOffset + cum + ch * e.size;
      out.set(
        oldBuf.subarray(
          e.dataOffset + ch * e.size,
          e.dataOffset + (ch + 1) * e.size,
        ),
        at,
      );
      cipherKeysoundChannel(out, at, e.size, true);
    }
    cum += e.size * e.ch;
  }

  for (let pos = 0; pos < LEAD_DUMMY; pos++) {
    const kp = 0x10 + pos * 0x10;
    if (!isZeroRow(out, kp)) {
      throw new Error(`先頭埋草の位置 ${pos} が実エントリと衝突`);
    }
    writeFillerRow(out, dv, kp, entries[0], true);
  }
  // 表は位置0から最終使用位置まで連続させる。穴があるとエンジンが先頭から走査して
  // 1つも読めなくなる (実機)。entry_id を保つ場合だけ穴が生じる
  for (let pos = LEAD_DUMMY; pos < maxId; pos++) {
    const kp = 0x10 + pos * 0x10;
    if (isZeroRow(out, kp)) {
      writeFillerRow(out, dv, kp, entries[0], false);
    }
  }

  dv.setUint32(KS_TABLE_END, entries.length, true);
  dv.setUint32(KS_TABLE_END + 4, dataTotal, true);
  dv.setUint32(KS_TABLE_END + 8, 1, true);
  dv.setUint32(KS_TABLE_END + 12, 0, true);

  const soundMap: Record<string, number> = {};
  for (let i = 0; i < entries.length; i++) {
    soundMap[String(entries[i].entryId)] = entryIds[i];
  }
  return { bytes: out, soundMap };
}
