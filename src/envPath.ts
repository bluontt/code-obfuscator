import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * On Windows, return process.env with MSYS2/MinGW bin dirs prepended to PATH
 * so gcc/g++ and Rust GNU linker are found. Otherwise return process.env.
 */
export function getWinEnv(): NodeJS.ProcessEnv {
  if (process.platform !== "win32") return process.env;
  const extra: string[] = [];
  const msys64 = "C:\\msys64";
  for (const sub of ["ucrt64", "mingw64", "mingw32"]) {
    const bin = join(msys64, sub, "bin");
    if (existsSync(bin)) extra.push(bin);
  }
  if (extra.length === 0) return process.env;
  const pathKey = Object.keys(process.env).find((k) => k.toLowerCase() === "path") || "Path";
  const pathVal = process.env[pathKey] || "";
  return { ...process.env, [pathKey]: [...extra, pathVal].join(";") };
}
