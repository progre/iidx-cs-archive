// 9th以降の曲名カードを、PBのloaderとHUDが扱える形へ並べ直し、単体ファイルとして置く。
// 記述子が`+4`から始まる世代(9th〜red)は、`+8`形式へ並べ替える。
// どの世代も、2枚目以降の絵をそれぞれのsheetの左上へ移す。
// manifestの参照は、そのファイルへ差し替える。周回の中で呼ぶ。
// legacy(3rd〜8th)はカードの形が違うので、`legacy_cards.ts`が原作の絵から組む。
import {
  type DisplaySong,
  generatedSourceArchive,
  isProgressStep,
} from "@csa/core";
import { titleCardRepackRequest, withRepackedTitleCard } from "../../repack.ts";
import type { DisplayLapPorts, DisplayLapTypes, LapDisc } from "../ports.ts";

type Ports<T extends DisplayLapTypes> = Pick<
  DisplayLapPorts<T>,
  "dataArchive" | "descriptorStartOf" | "openCardRepacker"
>;

/**
 * 9th以降の曲名カードは、`<discsDirectory>/<世代>/title_cards/NNNN.if`へ書く。
 * 前のビルドのファイルがあっても、原盤から読んで書く。返す`files`には、置いた`.if`を入れる。
 */
export async function prepareTitleCards<
  T extends DisplayLapTypes,
  M extends { songs: DisplaySong[] },
>(
  ports: Ports<T>,
  manifest: M,
  discsDirectory: string,
  lap: LapDisc<T["disc"]>,
): Promise<{ files: string[]; manifest: M }> {
  const repacker = ports.openCardRepacker(discsDirectory, lap);
  try {
    const songs: DisplaySong[] = [];
    const total = manifest.songs.length;
    for (const [count, song] of manifest.songs.entries()) {
      if (isProgressStep(count + 1, total)) {
        console.log(`${count + 1}/${total} ${lap.generation} title card`);
      }
      const request = titleCardRepackRequest(song, ports);
      if (request === null) {
        songs.push(song);
        continue;
      }
      const done = await repacker.repack(request);
      songs.push(withRepackedTitleCard(song, {
        archive: generatedSourceArchive("file", done.path),
        size: done.size,
      }));
    }
    return { files: repacker.paths(), manifest: { ...manifest, songs } };
  } finally {
    repacker.close();
  }
}
