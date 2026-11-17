import type { TitleEncoding, TitleLayout } from "@csa/core";
import { readBytes, readUint, writeBytes } from "./data_view.ts";

/** レコードに埋め込まれた題名の枠。埋め込む世代はすべてこの大きさ */
export const EMBEDDED_TITLE_BYTES = 0x40;

const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;
const PRINTABLE = /^\P{C}*$/u;

/** NUL終端の文字列を読む。encodingがnullの世代はASCIIだけを受け付ける */
export function decodeText(
  bytes: Uint8Array,
  encoding: TitleEncoding | null,
): string {
  const end = bytes.indexOf(0);
  const chars = end < 0 ? bytes : bytes.subarray(0, end);
  const text = encoding == null
    ? String.fromCharCode(...chars)
    : new TextDecoder(encoding, { fatal: true }).decode(chars);
  const printable = encoding == null ? PRINTABLE_ASCII : PRINTABLE;
  if (!printable.test(text)) {
    throw new Error(`印字できない文字がある: ${chars.toHex()}`);
  }
  return text;
}

/** ASCIIの文字列を、NUL終端を含むバイト列にする */
export function encodeAscii(text: string, frameBytes: number): Uint8Array {
  if (!PRINTABLE_ASCII.test(text)) {
    throw new Error(`ASCIIの印字可能文字でない: ${text}`);
  }
  if (text.length >= frameBytes) {
    throw new Error(`NUL終端が枠に収まらない: ${text}`);
  }
  return Uint8Array.from(`${text}\0`, (char) => char.charCodeAt(0));
}

export class TitleView {
  constructor(
    private readonly view: DataView,
    private readonly layout: TitleLayout,
    /** レコードの外にある題名を読むためのELF全体。持たないならnull */
    private readonly elf: Uint8Array | null,
    private readonly pointerBase: number,
  ) {}

  get text(): string {
    const { isElfPointer, offset } = this.layout;
    return isElfPointer
      ? this.stringAt(offset)
      : this.decode(readBytes(this.view, offset, EMBEDDED_TITLE_BYTES));
  }

  set text(value: string) {
    const { isElfPointer, offset, encoding } = this.layout;
    if (isElfPointer || encoding != null) {
      throw new Error("埋め込みのASCIIでない題名は書けない");
    }
    writeBytes(this.view, offset, encodeAscii(value, EMBEDDED_TITLE_BYTES));
  }

  /** 埋め込まれた題名の、NUL終端の手前までのバイト列。文字コードに従ったデコードはしない */
  get bytes(): Uint8Array {
    const { isElfPointer, offset } = this.layout;
    if (isElfPointer) {
      throw new Error("題名が埋め込みでない世代では読めない");
    }
    const frame = readBytes(this.view, offset, EMBEDDED_TITLE_BYTES);
    const end = frame.indexOf(0);
    return end < 0 ? frame : frame.subarray(0, end);
  }

  get full(): string | null {
    const offset = this.layout.fullOffset;
    return offset == null ? null : this.stringAt(offset);
  }

  /** 定義の文字コードとは別の文字コードで、完全な題名を読む */
  fullIn(encoding: TitleEncoding): string | null {
    const offset = this.layout.fullOffset;
    return offset == null ? null : this.stringAt(offset, encoding);
  }

  /**
   * 埋め込みの枠の全バイトを、指定の文字コードで読む。
   * NULでの打ち切りも空白の除去もせず、枠の中身をそのまま返す
   */
  embeddedIn(encoding: TitleEncoding): string {
    const { isElfPointer, offset } = this.layout;
    if (isElfPointer) {
      throw new Error("題名が埋め込みでない世代では読めない");
    }
    const bytes = readBytes(this.view, offset, EMBEDDED_TITLE_BYTES);
    return new TextDecoder(encoding, { fatal: true }).decode(bytes);
  }

  private stringAt(
    offset: number,
    encoding: TitleEncoding | null = this.layout.encoding,
  ): string {
    if (this.elf == null) {
      throw new Error("レコードの外にある題名を読むためのELFが無い");
    }
    const position = readUint(this.view, offset, 4) - this.pointerBase;
    return decodeText(this.elf.subarray(position), encoding);
  }

  private decode(bytes: Uint8Array): string {
    return decodeText(bytes, this.layout.encoding);
  }
}
