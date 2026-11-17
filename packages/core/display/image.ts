export type TextKind = "listTitle" | "bigTitle" | "genre" | "artist";

/** 描く文字の断片。副題は`TextStyle.subtitleScale`の大きさで、本題と同じ基準線に置く */
export interface TextSegment {
  text: string;
  subtitle?: boolean;
}

/** 曲DB+0xAC〜+0xB8の1組。file indexはPBの共有画像セット、spriteはその中の番号 */
export interface TitleSpriteRef {
  fileIndex: number;
  sprite: number;
}

export type ImageSetKind = "artist" | "big" | "genre" | "small";

/** RGBA 8bit の画素列。alpha 0 は透過である */
export interface Image {
  height: number;
  rgba: Uint8Array;
  width: number;
}
