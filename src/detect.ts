import { readFileSync } from "node:fs";

export type SupportedLang =
  | "javascript"
  | "typescript"
  | "python"
  | "rust"
  | "c"
  | "csharp"
  | "cpp";

export const SUPPORTED_LANGS: readonly SupportedLang[] = [
  "javascript",
  "typescript",
  "python",
  "rust",
  "c",
  "csharp",
  "cpp",
];

const EXT_MAP: Record<string, SupportedLang> = {
  ".js": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".py": "python",
  ".rs": "rust",
  ".c": "c",
  ".h": "c",
  ".cs": "csharp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".cc": "cpp",
  ".hpp": "cpp",
  ".hxx": "cpp",
};

const SHEBANG_MAP: Record<string, SupportedLang> = {
  "node": "javascript",
  "python": "python",
  "python3": "python",
  "python2": "python",
};

/**
 * Detect language from file path (extension) and optionally first line (shebang).
 */
export function detectLanguage(filePath: string, readShebang = true): SupportedLang | null {
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx > 0) {
    const ext = filePath.slice(dotIdx).toLowerCase();
    const byExt = EXT_MAP[ext];
    if (byExt) return byExt;
  }

  if (!readShebang) return null;
  try {
    const content = readFileSync(filePath, "utf-8");
    const firstLine = content.split("\n")[0].trim();
    const match = firstLine.match(/^#!\s*(?:\/usr\/bin\/env\s+)?(\w+)/);
    if (match) {
      const interpreter = match[1].toLowerCase();
      return SHEBANG_MAP[interpreter] ?? null;
    }
  } catch {
    // ignore read errors
  }
  return null;
}

export function getSupportedExtensions(): string[] {
  return Object.keys(EXT_MAP);
}
