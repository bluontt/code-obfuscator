import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getSupportedExtensions } from "./detect.js";

const SUPPORTED_EXTENSIONS = getSupportedExtensions();
const FILTER_EXTENSIONS_LINUX = SUPPORTED_EXTENSIONS.map((e) => `*${e}`).join(" ");

/**
 * Open the system file picker with multi-select. Resolves with selected file path(s), or null if cancelled.
 * Supports Windows (PowerShell + .NET), macOS (osascript), Linux (zenity or kdialog).
 */
export function openFileDialog(): Promise<string[] | null> {
  const platform = process.platform;
  if (platform === "win32") return openFileDialogWin32();
  if (platform === "darwin") return openFileDialogDarwin();
  return openFileDialogLinux();
}

function parsePaths(stdout: string | undefined): string[] {
  if (!stdout || !stdout.trim()) return [];
  return stdout
    .trim()
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function openFileDialogWin32(): Promise<string[] | null> {
  const filterPart = SUPPORTED_EXTENSIONS.map((e) => `*${e}`).join(";");
  const filter = `Supported files (${filterPart})|${filterPart}|All files (*.*)|*.*`;
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$d = New-Object System.Windows.Forms.OpenFileDialog
$d.Filter = "${filter.replace(/"/g, '`"')}"
$d.Title = "Select file(s) to secure"
$d.Multiselect = $true
if ($d.ShowDialog() -eq 'OK') { $d.FileNames | ForEach-Object { Write-Output $_ } }
`.trim();

  const tmpPath = join(tmpdir(), `obfuscator-picker-${Date.now()}.ps1`);
  writeFileSync(tmpPath, script, "utf-8");

  return new Promise((resolve) => {
    execFile(
      "powershell",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", tmpPath],
      { windowsHide: true },
      (err, stdout) => {
        try {
          if (existsSync(tmpPath)) unlinkSync(tmpPath);
        } catch {}
        if (err) {
          resolve(null);
          return;
        }
        const paths = parsePaths(stdout);
        resolve(paths.length > 0 ? paths : null);
      }
    );
  });
}

function openFileDialogDarwin(): Promise<string[] | null> {
  const script = 'choose file with prompt "Select file(s) to secure" with multiple selections allowed';
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const paths = parsePaths(stdout);
      resolve(paths.length > 0 ? paths : null);
    });
  });
}

function openFileDialogLinux(): Promise<string[] | null> {
  const run = (cmd: string, args: string[]): Promise<string[] | null> =>
    new Promise((resolve) => {
      execFile(cmd, args, (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const paths = parsePaths(stdout);
        resolve(paths.length > 0 ? paths : null);
      });
    });

  return run("zenity", [
    "--file-selection",
    "--title=Select file(s) to secure",
    "--multiple",
    "--separator=\n",
    `--file-filter=Supported | ${FILTER_EXTENSIONS_LINUX}`,
    "--file-filter=All files | *",
  ]).then((paths) => (paths !== null ? paths : run("kdialog", ["--getopenfilename", ".", `Supported (${FILTER_EXTENSIONS_LINUX})`, "--multiple", "--separate-output"])));
}
