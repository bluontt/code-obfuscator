#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, extname } from "node:path";
import type { SupportedLang } from "./detect.js";
import { detectLanguage, getSupportedExtensions, SUPPORTED_LANGS } from "./detect.js";
import { openFileDialog } from "./fileDialog.js";
import { obfuscate } from "./obfuscators/index.js";
import { DEFAULT_OPTIONS, type ObfuscatorOptions } from "./options.js";
import { ensureDependency } from "./ensureDependency.js";
import { runSecureCommand } from "./secureCommand.js";

function printUsage(): void {
  const exts = getSupportedExtensions().join(", ");
  console.log(`
Usage: obfuscate [inputFile ...] [options]

  Input file path(s). Language is auto-detected by extension (${exts}) or shebang.
  Multiple files: process each to its own output, or (Rust/C/C++ only) compile together into one binary.

Options:
  -o, --out <path>    Output file. Default: <input>-secured.<ext>
  --lang <lang>       Force language: javascript, typescript, python, rust, c, csharp, cpp (overrides detection)
  --no-rename         Disable variable/function renaming
  --no-encode-strings Disable string encoding
  -h, --help          Show this help
`);
}

function parseArgs(argv: string[]): { inputPaths: string[]; outPath: string | null; lang: string | null; options: ObfuscatorOptions } {
  const args = argv.slice(2);
  const inputPaths: string[] = [];
  let outPath: string | null = null;
  let lang: string | null = null;
  const options = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-h" || arg === "--help") {
      printUsage();
      process.exit(0);
    }
    if (arg === "-o" || arg === "--out") {
      outPath = args[++i] ?? null;
      continue;
    }
    if (arg === "--lang") {
      lang = args[++i] ?? null;
      continue;
    }
    if (arg === "--no-rename") {
      options.rename = false;
      continue;
    }
    if (arg === "--no-encode-strings") {
      options.encodeStrings = false;
      continue;
    }
    if (!arg.startsWith("-")) {
      inputPaths.push(arg);
    }
  }

  return { inputPaths, outPath, lang, options };
}

const COMPILED_LANGS: SupportedLang[] = ["rust", "c", "cpp"];

async function main(): Promise<void> {
  let { inputPaths, outPath, lang: langOverride, options } = parseArgs(process.argv);

  if (langOverride !== null && langOverride !== undefined) {
    const normalized = langOverride.toLowerCase();
    if (!SUPPORTED_LANGS.includes(normalized as SupportedLang)) {
      console.error(`Error: invalid --lang "${langOverride}".`);
      console.error(`Valid values: ${SUPPORTED_LANGS.join(", ")}`);
      process.exit(1);
    }
  }

  if (inputPaths.length === 0) {
    console.error("Opening file selection...");
    const selected = await openFileDialog();
    if (!selected || selected.length === 0) {
      console.error("No file selected.");
      process.exit(1);
    }
    inputPaths = selected;
  }

  const resolvedPaths = inputPaths.map((p) => resolve(p));
  for (const p of resolvedPaths) {
    if (!existsSync(p)) {
      console.error(`Error: file not found: ${p}`);
      process.exit(1);
    }
  }

  const langs = resolvedPaths.map((p) =>
    langOverride ? (langOverride.toLowerCase() as SupportedLang) : detectLanguage(p)
  );
  for (let i = 0; i < resolvedPaths.length; i++) {
    if (!langs[i]) {
      console.error(`Error: could not detect language for ${resolvedPaths[i]}. Use --lang or use a supported extension.`);
      process.exit(1);
    }
  }

  const binaryExt = process.platform === "win32" ? ".exe" : "";

  // Multiple files, all same compiled lang (rust/c/cpp) → compile together into one binary
  if (
    resolvedPaths.length > 1 &&
    langs[0] &&
    COMPILED_LANGS.includes(langs[0]) &&
    langs.every((l) => l === langs[0])
  ) {
    const lang = langs[0];
    const firstBase = basename(resolvedPaths[0], extname(resolvedPaths[0])) + "-secured";
    const outFileName = firstBase + binaryExt;
    const outResolved = outPath ? resolve(outPath) : resolve(dirname(resolvedPaths[0]), outFileName);
    try {
      await ensureDependency(lang);
      runSecureCommand(resolvedPaths, outResolved, lang);
      console.error(`Secured output: ${outResolved}`);
    } catch (err) {
      console.error("Failed:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
    return;
  }

  // Single file, or multiple files (processed separately; -o only for single file)
  let failed = false;
  for (let i = 0; i < resolvedPaths.length; i++) {
    const resolved = resolvedPaths[i];
    const lang = langs[i]!;
    const baseSecured = basename(resolved, extname(resolved)) + "-secured";
    const outFileName =
      ["rust", "c", "cpp", "csharp"].includes(lang) ? baseSecured + binaryExt : baseSecured + extname(resolved);
    const outResolved =
      resolvedPaths.length === 1 && outPath !== null ? resolve(outPath) : resolve(dirname(resolved), outFileName);

    try {
      if (lang === "javascript" || lang === "typescript") {
        const source = readFileSync(resolved, "utf-8");
        const result = obfuscate(source, lang, options);
        writeFileSync(outResolved, result, "utf-8");
        console.error(`Wrote ${result.length} chars to ${outResolved}`);
      } else {
        await ensureDependency(lang);
        runSecureCommand(resolved, outResolved, lang);
        console.error(`Secured output: ${outResolved}`);
      }
    } catch (err) {
      console.error(`Failed (${resolved}):`, err instanceof Error ? err.message : err);
      failed = true;
    }
  }
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
