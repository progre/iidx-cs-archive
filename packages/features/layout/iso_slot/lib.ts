// 生成ISOの書き先を決める。既定では1つのファイルへ書く。開発者向けに、2つの枠へ交互に書く方法もある。
// 枠を使うときは、次に書く枠を決める。書き終えたら、どの枠にどのISOを書いたかを台帳に記録する。
export * from "./build_outputs.ts";
export * from "./iso_slot.ts";
export * from "./iso_slot_gateway.ts";
export * from "./write_iso.ts";
