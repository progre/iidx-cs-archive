import type { SongDb, SongDbRecord } from "@csa/contents-song-db";

// 書き出すファイルの名前。曲のファイルは`<世代>_<曲DB index>_<題名>`で始める。

const UNSAFE_FILE_NAME_CHARS = /["*/:<>?\\|]/g;
const TRAILING_DOTS_AND_SPACES = /[. ]+$/;

export function songFileNameOf(
  generation: string,
  index: number,
  title: string,
): string {
  const safeTitle = title
    .replaceAll(UNSAFE_FILE_NAME_CHARS, "_")
    .replace(TRAILING_DOTS_AND_SPACES, "");
  const number = String(index).padStart(3, "0");
  return `${generation}_${number}_${safeTitle}`;
}

/** ELFに埋め込まれたlegacy tileを世代ごとに書くフォルダーの名前 */
export function embeddedTileDirNameOf(generation: string): string {
  return `${generation}_tile_elf`;
}

/** 読み出し元のアーカイブ名は拡張子を外して小文字にする */
export function sourceNameOf(entry: { archive: string; index: number }) {
  const archive = entry.archive.replace(/\.[^.]*$/, "").toLowerCase();
  return `${archive}_${entry.index}`;
}

export interface Song {
  index: number;
  record: SongDbRecord;
}

/** 題名は大文字と小文字を区別せずに比べる */
export function songsOf(db: SongDb, title: string | null): Song[] {
  const songs = Array.from(
    { length: db.length },
    (_, index) => ({ index, record: db.record(index) }),
  );
  if (title == null) {
    return songs;
  }
  const wanted = title.toUpperCase();
  return songs.filter(({ record }) =>
    record.title.text.toUpperCase() === wanted
  );
}
