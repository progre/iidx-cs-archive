// 曲DBとファイル表から、曲が参照するファイルの一覧(songmap相当)を作る。

import type {
  ElfDefinition,
  SongmapDoc,
  SongmapSong,
  SongmapSoundPair,
} from "@csa/core";
import { FileTable } from "../file_table.ts";
import {
  Entries,
  readSong,
  type SlotNames,
  type SongMeta,
} from "./read/mod.ts";
import type { SongmapRecord, SongmapRule } from "./types.ts";

const SLOTS =
  "sp_beginner sp_normal sp_hyper sp_another sp_black dp_beginner dp_normal dp_hyper dp_another dp_black"
    .split(" ");

const NEGATIVE_16 = 0x8000;

type Lookup = (songId: number, name: string | null) => number | null;

/** 同じ(曲, 素材名)を指すファイルが複数あれば、番号が大きいほうを返す */
function lookupOf(entries: Entries): Lookup {
  const found = new Map<string, number>();
  entries.list.forEach((entry, index) => {
    entry.refs.forEach(({ songId, name }) =>
      found.set(`${songId}\n${name}`, index)
    );
  });
  return (songId, name) =>
    name == null ? null : found.get(`${songId}\n${name}`) ?? null;
}

function soundsOf(
  names: [string, SlotNames][],
  lookup: Lookup,
  songId: number,
): SongmapSoundPair[] {
  return names.flatMap(([pair, { sounds, bgm }]) => {
    const keysound = lookup(songId, sounds);
    const bgmFile = lookup(songId, bgm);
    return keysound == null && bgmFile == null
      ? []
      : [{ pair, keysound, bgm: bgmFile }];
  });
}

/** 7thは、曲DBの1本目が負の曲だけ、別のアーカイブの2本目を足す */
function wideVideoOf(
  record: SongmapRecord,
  def: ElfDefinition,
  entries: Entries,
): number[] {
  const { video } = def.songDbRecordLayout;
  const first = record.video.primary.at(0) ?? 0;
  const value = record.video.secondary?.at(0);
  const archive = record.video.secondaryArchive;
  if (!video.secondaryIsFallback || first < NEGATIVE_16) {
    return [];
  }
  if (value == null || archive == null) {
    throw new Error("2本目のムービーの欄が無い");
  }
  return [entries.baseOf(archive) + value];
}

function songOf(
  meta: SongMeta,
  record: SongmapRecord,
  lookup: Lookup,
  extra: (record: SongmapRecord) => number[],
): SongmapSong {
  const { songId } = meta;
  const named = SLOTS.flatMap((slot) => {
    const names = meta.charts.get(slot);
    return names == null ? [] : [[slot, names] as [string, SlotNames]];
  });
  const charts = named.flatMap(([slot, { chart, level }]) => {
    const file = lookup(songId, chart);
    if (file == null) {
      return [];
    }
    // レベルが0の譜面は、抽出済みのJSONと同じくnullを持つ。SongmapChartの型はnullを含まない
    return [
      [slot, { chart: file, level: level as number | number[] }] as const,
    ];
  });
  const sounds = soundsOf(named, lookup, songId);
  const videos = meta.videos
    .map((name) => lookup(songId, name))
    .filter((file) => file != null);
  const overlayFile = lookup(songId, meta.overlay);
  return {
    song_id: songId,
    title: meta.title,
    charts: Object.fromEntries(charts),
    sounds,
    keysound: sounds.at(0)?.keysound ?? null,
    bgm: sounds.at(0)?.bgm ?? null,
    videos: [...videos, ...extra(record)],
    overlay: overlayFile,
  };
}

export interface SongmapInput {
  elf: Uint8Array;
  def: ElfDefinition;
  rule: SongmapRule;
  /** 曲の番号が0から始まる曲DBのレコード */
  records: readonly SongmapRecord[];
}

/** 世代の songmap を作る処理が使う関数。曲DBと規則の実装は app が渡す */
export interface GenerationSongmapPorts<Rule extends SongmapRule> {
  definitionOf: (generation: string) => ElfDefinition;
  openDb: (elf: Uint8Array, def: ElfDefinition) => {
    length: number;
    record: (index: number) => SongmapRecord;
  };
  ruleOf: (generation: string) => Rule;
  songCountOf: (rule: Rule, dbLength: number) => number;
}

/** ビルドが使うsongmapを、読み込み済みの実行ファイルから作る。呼ぶたびに作り直す */
export function songmapOfGeneration<Rule extends SongmapRule>(
  ports: GenerationSongmapPorts<Rule>,
  generation: string,
  elf: Uint8Array,
): SongmapDoc {
  const rule = ports.ruleOf(generation);
  const def = ports.definitionOf(generation);
  const db = ports.openDb(elf, def);
  const records = Array.from(
    { length: ports.songCountOf(rule, db.length) },
    (_, index) => db.record(index),
  );
  return songmapOf({ elf, def, rule, records });
}

export function songmapOf(
  { elf, def, rule, records }: SongmapInput,
): SongmapDoc {
  const entries = new Entries(
    new FileTable(elf, def.fileTable),
    rule.archiveOrder,
    rule.archiveNames === "lowercase" ? (name) => name.toLowerCase() : (n) => n,
  );
  const ctx = { def, elfLength: elf.length, entries, rule };
  const metas = records.map((record, songId) => readSong(songId, record, ctx));
  const lookup = lookupOf(entries);
  const extra = (record: SongmapRecord) => wideVideoOf(record, def, entries);
  const songs = metas.map((meta, i) => songOf(meta, records[i], lookup, extra));
  return {
    executable: def.fileName,
    archives: [...new Set(entries.list.map((entry) => entry.archive))].sort(),
    songs,
    files: entries.list.map(({ archive, offset, size, refs }, index) => ({
      index,
      archive,
      offset,
      size,
      refs: refs.map((ref) => ref.name),
    })),
  };
}
