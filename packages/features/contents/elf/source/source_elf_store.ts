// 原盤の実行ファイルを、周回でストレージへ書き、後はそこから読む。メモリーには覚えない。
// ファイルの読み書きは、`SourceElfPorts`の関数が行う。

export interface SourceElfPorts {
  read: (generation: string) => Uint8Array;
  write: (generation: string, elf: Uint8Array) => void;
}

export class SourceElfStore {
  readonly #ports: SourceElfPorts;
  /** この実行で書いた世代。前の実行のファイルが残っていても読まない */
  readonly #saved = new Set<string>();

  constructor(ports: SourceElfPorts) {
    this.#ports = ports;
  }

  /** 既にファイルがあっても書き直す */
  save(generation: string, elf: Uint8Array): void {
    this.#ports.write(generation, elf);
    this.#saved.add(generation);
  }

  /** 呼ぶたびにファイルから読む */
  elfOf(generation: string): Uint8Array {
    if (!this.#saved.has(generation)) {
      throw new Error(`${generation}の実行ファイルが周回で書かれていない`);
    }
    return this.#ports.read(generation);
  }
}
