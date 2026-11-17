/**
 * 曲DBエントリーの、難易度1つぶんの欄を読み書きする。
 * 欄は、レベル・ノーツ数・譜面・キー音・BGMである。
 */

import type { MutableElf } from "../../../elf/mod.ts";
import { type CsaSongDb, entryAddressOf, layoutOf } from "../song_db.ts";

interface Field {
  bytes: number;
  offset: number;
}

/** 曲の枠と難易度名 */
export interface ChartAt {
  index: number;
  name: string;
}

/**
 * 音の欄は8組で、黒ANOTHERの組は無い。
 * 黒ANOTHERのキー音の位置を他の難易度と同じ式で求めると、ノーツ数の欄の先頭と同じ位置になる。
 * そのため、キー音とBGMの値は、求めた位置が音の欄の中にある難易度にだけ写す。
 */
function soundFieldsOf({ format }: CsaSongDb, name: string): Field[] {
  const sounds = layoutOf(format).chart.sounds;
  const end = sounds.offset + sounds.count * 2;
  return [format.keysoundFieldOffset(name), format.bgmFieldOffset(name)]
    .filter((offset) => offset < end)
    .map((offset) => ({ bytes: 2, offset }));
}

export function fieldsOf(songDb: CsaSongDb, name: string): Field[] {
  const { format } = songDb;
  return [
    { bytes: 1, offset: format.levelFieldOffset(name) },
    ...format.notesFieldOffsets(name).map((offset) => ({ bytes: 2, offset })),
    { bytes: 4, offset: format.chartFieldOffset(name) },
    ...soundFieldsOf(songDb, name),
  ];
}

export const fieldBytes = (
  elf: MutableElf,
  songDb: CsaSongDb,
  chart: ChartAt,
) =>
  fieldsOf(songDb, chart.name).map(({ bytes, offset }) =>
    elf.slice(entryAddressOf(songDb, chart.index) + offset, bytes)
  );

/** 欄の全バイトの仮想アドレス */
export const fieldAddressesOf = (songDb: CsaSongDb, chart: ChartAt) =>
  fieldsOf(songDb, chart.name).flatMap(({ bytes, offset }) =>
    Array.from(
      { length: bytes },
      (_, i) => entryAddressOf(songDb, chart.index) + offset + i,
    )
  );

export function copyChart(
  elf: MutableElf,
  songDb: CsaSongDb,
  from: ChartAt,
  to: ChartAt,
): void {
  // 音の欄は並びの最後にあるので、写し先に無い欄は後ろから落ちる
  const source = fieldBytes(elf, songDb, from);
  fieldsOf(songDb, to.name).forEach(({ offset }, i) =>
    elf.setBytes(entryAddressOf(songDb, to.index) + offset, source[i])
  );
}

export const hasChart = (elf: MutableElf, songDb: CsaSongDb, chart: ChartAt) =>
  fieldBytes(elf, songDb, chart)[0][0] !== 0;
