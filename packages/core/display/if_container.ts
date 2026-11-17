/** `.if`コンテナの記述子の開始位置。PBのloaderは`+8`固定で読む */
export type DescriptorStart = 4 | 8;

/** 項目の種類。0と1はsprite、2は同じ表の別のanimation、3は用途未確定 */
export type AnimationItemKind = 0 | 1 | 2 | 3;

export interface FramePoint {
  frame: number;
}

export interface PositionPoint extends FramePoint {
  x: number;
  y: number;
}

/** 百分率 */
export interface ZoomPoint extends FramePoint {
  scaleX: number;
  scaleY: number;
}

/** 百分率。2つ目の値の意味は未確定 */
export interface FadePoint extends FramePoint {
  opacity: number;
  opacity2: number;
}

export interface RotationPoint extends FramePoint {
  rotation: number;
}

export interface AnimationItem {
  endFrame: number;
  fades: FadePoint[];
  /** kindが2のとき、参照先animationの再生開始frame */
  frameOffset: number;
  /** 合成の仕方。0が通常 */
  format: number;
  kind: AnimationItemKind;
  /** 百分率。100を超える値は100として扱う */
  opacity: number;
  positions: PositionPoint[];
  rotations: RotationPoint[];
  startFrame: number;
  /** kindが0か1ならsprite番号、2ならanimation番号 */
  target: number;
  /** 画面中央からの基準位置 */
  x: number;
  y: number;
  zooms: ZoomPoint[];
}

export interface Animation {
  endFrame: number;
  /** 画面の大きさ。終端項目のx, yの2倍 */
  height: number;
  /** ファイル内の並び。描画は末尾の項目から手前へ重ねる */
  items: AnimationItem[];
  startFrame: number;
  width: number;
}

export interface IfSheet {
  height: number;
  width: number;
}

export interface IfSprite {
  h: number;
  w: number;
  x: number;
  y: number;
}

export interface IfMetadata {
  animationCount: number;
  animationsOffset: number;
  sheets: IfSheet[];
  spriteInfoOffset: number;
  sprites: IfSprite[];
}

export interface IfPackage {
  files: Uint8Array[];
  metadata: IfMetadata;
  /** 全fileの圧縮データが終わる位置。以降はセクタ詰め */
  payloadEnd: number;
}
