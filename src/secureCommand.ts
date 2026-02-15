import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import type { SupportedLang } from "./detect.js";
import { getWinEnv } from "./envPath.js";

const isWin = process.platform === "win32";

/**
 * Run the appropriate external command to secure (obfuscate/compile) file(s).
 * Writes the result to outputPath. For Rust/C/C++, inputPathOrPaths can be multiple source files.
 */
export function runSecureCommand(
  inputPathOrPaths: string | string[],
  outputPath: string,
  lang: SupportedLang
): void {
  const paths = Array.isArray(inputPathOrPaths) ? inputPathOrPaths : [inputPathOrPaths];
  const single = paths[0];
  switch (lang) {
    case "python":
      runPythonSecure(single, outputPath);
      break;
    case "rust":
      runRustSecure(paths, outputPath);
      break;
    case "c":
      runCSecure(paths, outputPath);
      break;
    case "cpp":
      runCppSecure(paths, outputPath);
      break;
    case "csharp":
      runCSharpSecure(single, outputPath);
      break;
    default:
      throw new Error(`No secure command for language: ${lang}`);
  }
}

function runPythonSecure(inputPath: string, outputPath: string): void {
  const outDir = mkdtempSync(join(tmpdir(), "obfuscator-py-"));
  try {
    const r = spawnSync("pyarmor", ["gen", "-O", outDir, inputPath], {
      stdio: "pipe",
      encoding: "utf-8",
    });
    if (r.status !== 0) {
      throw new Error(r.stderr?.trim() || r.error?.message || "pyarmor failed");
    }
    let outFile = join(outDir, basename(inputPath));
    if (!existsSync(outFile)) {
      const inDist = join(outDir, "dist", basename(inputPath));
      if (existsSync(inDist)) outFile = inDist;
    }
    if (existsSync(outFile)) {
      const content = readFileSync(outFile, "utf-8");
      writeFileSync(outputPath, content, "utf-8");
    } else {
      throw new Error("PyArmor did not produce output file");
    }
  } catch (e) {
    throw new Error(
      "Python: Install PyArmor and run from project dir: pip install pyarmor. " +
        (e instanceof Error ? e.message : String(e))
    );
  } finally {
    try {
      rmSync(outDir, { recursive: true });
    } catch {}
  }
}

function runRustSecure(inputPaths: string[], outputPath: string): void {
  const env = isWin ? getWinEnv() : process.env;
  const run = (): ReturnType<typeof spawnSync> =>
    spawnSync("rustc", [...inputPaths, "-o", outputPath], {
      stdio: "pipe",
      encoding: "utf-8",
      env,
    });
  let r = run();
  if (r.status !== 0 && isWin && (r.stderr?.includes("link.exe") ?? r.error?.message?.includes("link.exe"))) {
    spawnSync("rustup", ["default", "stable-x86_64-pc-windows-gnu"], { stdio: "inherit", encoding: "utf-8", env });
    r = run();
  }
  if (r.status !== 0) {
    const stderr = (typeof r.stderr === "string" ? r.stderr : r.stderr ? String(r.stderr) : "").trim();
    if (stderr) console.error(stderr);
    const msg = stderr || (r.error?.message ?? "Rust compile failed.");
    throw new Error(msg.includes("link.exe") ? "Rust needs a linker. Install MSYS2 (for gcc) and run: rustup default stable-x86_64-pc-windows-gnu" : msg);
  }
}

function runCSecure(inputPaths: string[], outputPath: string): void {
  const result = spawnSync("gcc", [...inputPaths, "-o", outputPath, "-O2"], {
    stdio: "inherit",
    encoding: "utf-8",
    env: isWin ? getWinEnv() : process.env,
  });
  if (result.status !== 0) {
    throw new Error("C compile failed. Is gcc installed? (On Windows, install MSYS2 and add its bin to PATH, e.g. C:\\msys64\\ucrt64\\bin)");
  }
}

function runCppSecure(inputPaths: string[], outputPath: string): void {
  const result = spawnSync("g++", [...inputPaths, "-o", outputPath, "-O2"], {
    stdio: "inherit",
    encoding: "utf-8",
    env: isWin ? getWinEnv() : process.env,
  });
  if (result.status !== 0) {
    throw new Error("C++ compile failed. Is g++ installed? (On Windows, install MSYS2 and add its bin to PATH, e.g. C:\\msys64\\ucrt64\\bin)");
  }
}

function runCSharpSecure(inputPath: string, outputPath: string): void {
  // Try csc (Framework) first, then dotnet
  const cscResult = spawnSync("csc", ["/out:" + outputPath, inputPath], {
    stdio: "inherit",
    encoding: "utf-8",
  });
  if (cscResult.status === 0) return;
  // dotnet: create temp project and build single file
  const tmpDir = mkdtempSync(join(tmpdir(), "obfuscator-cs-"));
  const outDir = join(tmpDir, "out");
  try {
    execSync("dotnet new console -o . -n App --force", { cwd: tmpDir, stdio: "pipe", encoding: "utf-8" });
    cpSync(inputPath, join(tmpDir, "Program.cs"), { force: true });
    try {
      execSync("dotnet publish -c Release -o out", { cwd: tmpDir, stdio: "inherit", encoding: "utf-8" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(msg + " Ensure your .cs file has a static void Main entry point.");
    }
    const exeName = "App" + (isWin ? ".exe" : "");
    const exe = join(outDir, exeName);
    const dll = join(outDir, "App.dll");
    const unixExe = join(outDir, "App");
    if (existsSync(exe)) {
      cpSync(exe, outputPath);
    } else if (!isWin && existsSync(unixExe)) {
      cpSync(unixExe, outputPath);
    } else if (existsSync(dll)) {
      cpSync(dll, outputPath.replace(/\.exe$/i, ".dll"));
    } else {
      throw new Error("dotnet publish did not produce output");
    }
  } finally {
    try {
      rmSync(tmpDir, { recursive: true });
    } catch {}
  }
}
