// `CHANGELOG.md`から、指定したバージョンの変更点を標準出力へ書く。GitHub の Release の本文に使う。
// 実行: deno run --allow-read=CHANGELOG.md packages/utils/release_notes/main.ts v<バージョン>
// 節が無いか空なら、何も書かずに失敗する。

import { changelogSection } from "./changelog.ts";

const CHANGELOG_PATH = "CHANGELOG.md";

function main(): void {
  const version = Deno.args[0] ?? "";
  if (!/^v\d+\.\d+\.\d+$/.test(version)) {
    console.error("Usage: main.ts vX.Y.Z");
    Deno.exit(1);
  }
  const notes = changelogSection(
    Deno.readTextFileSync(CHANGELOG_PATH),
    version,
  );
  if (notes === null || notes === "") {
    console.error(
      `Write the changes for ${version} in ${CHANGELOG_PATH} first.`,
    );
    Deno.exit(1);
  }
  console.log(notes);
}

if (import.meta.main) {
  main();
}
