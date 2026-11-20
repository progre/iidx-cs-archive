/** `CHANGELOG.md`から、`## <バージョン>`の見出しの下に書いた変更点を取り出す。見出しが無ければ null */
export function changelogSection(
  text: string,
  version: string,
): string | null {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${version}`);
  if (start < 0) {
    return null;
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return rest.slice(0, end < 0 ? rest.length : end).join("\n").trim();
}
