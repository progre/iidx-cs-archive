// `.if`コンテナの読み書き。置き場は次のとおり。
// - format/: コンテナの読み書き、圧縮、記述子の開始位置、metadataのanimation表
// - image_set/: 共有画像セットのspriteの配置、分割、追加
// - texture/: textureのswizzle、パレット、spriteの灰色化
// - legacy_image/: legacyの絵からの組み立て
// - title_card/: 曲名カードの絵の並べ直し
// - repack/: 素材の`.if`を周回で書き出す
// - title_image_set/: 共有画像セットの読み出し、合成、分割の操作
export * from "./repack_if.ts";
export { imageSetOps, packImages } from "./title_image_set/mod.ts";
export * from "./format/mod.ts";
export * from "./image_set/sprites/mod.ts";
export * from "./image_set/mod.ts";
export * from "./image_set/merge/mod.ts";
export * from "./texture/mod.ts";
export * from "./legacy_image/mod.ts";
export * from "./title_image_set/mod.ts";
export * from "./title_image_set/mod.ts";
