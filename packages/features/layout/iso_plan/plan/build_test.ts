import { newAbcIndices } from "./abc_index.ts";
import { createPlacementPlan } from "./build.ts";
import { checkOverlayPlan } from "./report/mod.ts";
import {
  assertEquals,
  fixture,
  planInput,
  withOverlay,
  withVariant,
} from "./testing.ts";

const SELECT_SCREEN_LIMIT = 100;

Deno.test("新規資産は原盤の終端へ曲順に連なり絶対LBAを持つ", () => {
  const plan = createPlacementPlan(fixture(), {
    abcCapacity: 1069,
    imageSetFiles: [{ data1Index: 1312, path: "1312.if", size: 3000 }],
    data1BaseLba: 50,
    reusableRanges: [],
    sourceVolumeSectors: 100,
  });
  assertEquals(plan.assetRange.startLba, 100, "assets start");
  assertEquals(plan.assets[0].lba, 100, "asset0 lba");
  assertEquals(plan.assets[1].lba, 101, "asset1 lba");
  assertEquals(plan.assets[2].lba, 102, "asset2 lba");
  assertEquals(plan.assets[2].newAbcIndex, 1068, "asset2 ABC index");
  assertEquals(plan.assetRange.endLba, 103, "assets end");
  assertEquals(plan.data1.startLba, 103, "DATA1 start");
  assertEquals(plan.data1.titleCards.length, 2, "shared .if");
  assertEquals(plan.data1.titleCards[0].newData1Index, 1469, "first DATA1");
  assertEquals(plan.data1.titleCards[0].relativeSector, 53, "relative sector");
  assertEquals(
    plan.data1.titleCards[0].targetSongIndices.length,
    2,
    "shared songs",
  );
  assertEquals(plan.data1.imageSets[0].lba, 107, "imageSet lba");
  assertEquals(plan.totalSectors, 109, "DATA1 end");
});

// 原作で1本の素材を複数の曲が使う。ISOへは1本だけ載せ、曲DBは同じABC indexを指す。
Deno.test("同じ素材を指す曲はISOの実体とABC indexを共有する", () => {
  const manifest = fixture();
  manifest.songs[2].assets[0] = {
    ...manifest.songs[0].assets[0],
    references: [{ fieldOffset: 0x24, width: "u32" }],
  };
  const plan = createPlacementPlan(manifest, {
    abcCapacity: 1069,
    imageSetFiles: [],
    data1BaseLba: 50,
    reusableRanges: [],
    sourceVolumeSectors: 100,
  });
  assertEquals(plan.placements.length, 2, "ISOへ載る実体");
  assertEquals(plan.assets.length, 3, "曲DBが持つ参照");
  assertEquals(
    plan.assets[2].newAbcIndex,
    plan.assets[0].newAbcIndex,
    "共有するABC index",
  );
  assertEquals(plan.assets[2].lba, plan.assets[0].lba, "共有するLBA");
  assertEquals(plan.assetRange.endLba, 102, "実体1本ぶん縮む");
});

// 曲リストHTMLは配置計画より前に書くので、採番を別に呼んで識別子を出す。
// 2つの採番が食い違うと、HTMLの識別子がISOの中の実体を指さなくなる。
Deno.test("曲リストHTMLの採番は配置計画の割り当てと一致する", () => {
  const manifest = fixture();
  const plan = createPlacementPlan(manifest, {
    abcCapacity: 1069,
    imageSetFiles: [],
    data1BaseLba: 50,
    reusableRanges: [],
    sourceVolumeSectors: 100,
  });
  assertEquals(
    newAbcIndices(manifest).flat().join(" "),
    plan.assets.map((asset) => asset.newAbcIndex).join(" "),
    "ABC indexの採番",
  );
});

// オーバーレイは同じ世代の同じ`.if`なら1件を共有し、曲名カードの後ろへ続けて採番される。
Deno.test("オーバーレイのパッケージは曲名カードの後ろへ連番で並ぶ", () => {
  const manifest = withOverlay();
  const plan = createPlacementPlan(manifest, planInput);
  const packages = plan.data1.overlayPackages;
  assertEquals(packages.length, 2, "DATA1へ載る本数");
  assertEquals(packages[0].newData1Index, 1471, "曲名カード2件の次");
  assertEquals(packages[1].newData1Index, 1472, "連番");
  assertEquals(packages[0].sectors, 4, "8192バイトのセクタ数");
  const summary = checkOverlayPlan(manifest, plan, SELECT_SCREEN_LIMIT);
  assertEquals(summary.songs, 2, "オーバーレイを持つ曲");
  assertEquals(summary.packages, 2, "パッケージ");
  assertEquals(summary.maxSectors, 4, "最大セクタ数");
  assertEquals(summary.overLimit, 0, "選曲画面の上限を超える本数");
  const strict = checkOverlayPlan(manifest, plan, 3);
  assertEquals(strict.overLimit, 1, "上限3セクターを超える8192バイトの1本");
});

// 裏エントリーは曲数の窓の外へ置くので、選曲リストにもスコア枠にも入らない。
Deno.test("差し替え元の無い裏エントリーは停止する", () => {
  const manifest = withVariant();
  manifest.songs[2].variantOf = { rule: "always", targetSongIndex: 150 };
  let message = "";
  try {
    createPlacementPlan(manifest, planInput);
  } catch (error) {
    message = String(error);
  }
  if (!message.includes("裏エントリーの差し替え元が無い")) {
    throw new Error(`差し替え元の欠落で停止しなかった: ${message}`);
  }
});

Deno.test("PB原盤の曲の枠を差し替え元にする裏エントリーは、manifestに表が無くても置ける", () => {
  const manifest = withVariant();
  manifest.songs[2].variantOf = { rule: "alternate", targetSongIndex: 34 };
  createPlacementPlan(manifest, planInput);
});

Deno.test("ABC capacity不足は停止する", () => {
  let message = "";
  try {
    createPlacementPlan(fixture(), {
      abcCapacity: 1068,
      imageSetFiles: [],
      data1BaseLba: 50,
      reusableRanges: [],
      sourceVolumeSectors: 100,
    });
  } catch (error) {
    message = String(error);
  }
  if (!message.includes("ABC capacity")) {
    throw new Error(`capacity不足で停止しなかった: ${message}`);
  }
});
