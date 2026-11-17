import { assertEquals } from "@std/assert";
import { movieFileNameOf } from "./main.ts";

Deno.test("mkvの名前は、世代とsongmapの通し番号をつなぐ", () => {
  assertEquals(movieFileNameOf("emp", 791), "emp_791.mkv");
});
