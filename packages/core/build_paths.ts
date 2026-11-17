// ビルドが書くファイルの置き場。リポジトリのルートからの相対パス。
// ファイルごとの置き場は、ファイルを書くパッケージがこの定数を元に決める。

export const BUILD_DIRECTORY = "build";

/** 中間ファイルは、この下にだけ置く */
export const INTERMEDIATE_DIRECTORY = `${BUILD_DIRECTORY}/intermediate`;
