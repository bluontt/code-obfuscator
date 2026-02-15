import type { SupportedLang } from "../detect.js";
import type { ObfuscatorOptions } from "../options.js";
import { obfuscateJavaScript } from "./javascript.js";

export function obfuscate(
  source: string,
  lang: SupportedLang,
  options: ObfuscatorOptions
): string {
  switch (lang) {
    case "javascript":
    case "typescript":
      return obfuscateJavaScript(source, options);
    case "python":
      throw new Error("Python obfuscation is not implemented yet.");
    case "rust":
      throw new Error("Rust obfuscation is not implemented yet.");
    case "c":
    case "cpp":
      throw new Error("C/C++ obfuscation is not implemented yet.");
    case "csharp":
      throw new Error("C# obfuscation is not implemented yet.");
    default:
      throw new Error(`Unsupported language: ${lang}`);
  }
}
