import { assertEquals } from "@std/assert";
import { changelogSection } from "./changelog.ts";

const text = "# Changelog\n\n## v0.2.0\n\n- B\n\n## v0.1.0\n\n- A\n";

Deno.test("見出しのバージョンの節を、次の見出しの手前まで取り出す", () => {
  assertEquals(changelogSection(text, "v0.2.0"), "- B");
  assertEquals(changelogSection(text, "v0.1.0"), "- A");
});

Deno.test("見出しが無いバージョンは null", () => {
  assertEquals(changelogSection(text, "v0.3.0"), null);
});
