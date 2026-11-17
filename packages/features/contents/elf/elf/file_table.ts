// ELF内蔵ファイル表。起動時にELFの初期化処理がこの表を名前で走査し、
// 一致した先頭LBAを0x78FDE0の6要素配列へ書き込む。
// A/B/Cのアーカイブ基底LBAはこの配列だけが持つ。
// ISO9660のディレクトリレコードは読まれない。
// アーカイブを再配置したらこの表も直す。
import type { MutableElf } from "./elf.ts";

const TABLE_VADDR = 0x260a80;
const TABLE_ENTRIES = 16;
const ENTRY_SIZE = 0x20;
const NAME_POINTER = 0;
const FIRST_LBA = 8;
const LAST_LBA = 16;
const SECTOR_COUNT = 24;

export interface FileRelocation {
  /** 表に載っている名前。先頭の`\`とバージョン`;1`まで含む */
  name: string;
  /** 元イメージでのLBA。取り違えを検出するために照合する */
  fromLba: number;
  sectors: number;
  toLba: number;
}

function readName(elf: MutableElf, pointer: number): string {
  const bytes: number[] = [];
  for (let vaddr = pointer; bytes.length < 64; vaddr++) {
    const byte = elf.slice(vaddr, 1)[0];
    if (byte === 0) return String.fromCharCode(...bytes);
    bytes.push(byte);
  }
  throw new Error(`0x${pointer.toString(16)}の名前が終端しない`);
}

/** 表の各エントリを名前で引き当て、先頭LBA・終端LBA・セクタ数を差し替える */
export function relocateFileTable(
  elf: MutableElf,
  relocations: readonly FileRelocation[],
): void {
  const remaining = new Map(relocations.map((entry) => [entry.name, entry]));
  for (let index = 0; index < TABLE_ENTRIES; index++) {
    const entry = TABLE_VADDR + index * ENTRY_SIZE;
    const name = readName(elf, elf.u32(entry + NAME_POINTER));
    const relocation = remaining.get(name);
    if (relocation === undefined) continue;
    remaining.delete(name);
    const current = elf.u32(entry + FIRST_LBA);
    if (current !== relocation.fromLba) {
      throw new Error(
        `${name}の先頭LBA ${current} が元イメージの ${relocation.fromLba} と違う`,
      );
    }
    elf.setU32(entry + FIRST_LBA, relocation.toLba);
    elf.setU32(entry + LAST_LBA, relocation.toLba + relocation.sectors - 1);
    elf.setU32(entry + SECTOR_COUNT, relocation.sectors);
  }
  if (remaining.size > 0) {
    throw new Error(`ファイル表に無い名前: ${[...remaining.keys()].join(" ")}`);
  }
}

/** 書き出したELFから読み戻して、再配置が反映されているかを確かめる */
export function verifyFileTable(
  elf: MutableElf,
  relocations: readonly FileRelocation[],
): void {
  const expected = new Map(relocations.map((entry) => [entry.name, entry]));
  let matched = 0;
  for (let index = 0; index < TABLE_ENTRIES; index++) {
    const entry = TABLE_VADDR + index * ENTRY_SIZE;
    const relocation = expected.get(
      readName(elf, elf.u32(entry + NAME_POINTER)),
    );
    if (relocation === undefined) continue;
    matched++;
    const first = elf.u32(entry + FIRST_LBA);
    const last = elf.u32(entry + LAST_LBA);
    const sectors = elf.u32(entry + SECTOR_COUNT);
    if (
      first !== relocation.toLba ||
      last !== relocation.toLba + relocation.sectors - 1 ||
      sectors !== relocation.sectors
    ) {
      throw new Error(`${relocation.name}のファイル表が読み戻せない`);
    }
  }
  if (matched !== relocations.length) {
    throw new Error(`ファイル表の照合が${matched}件で足りない`);
  }
}
