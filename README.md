# code-obfuscator

A CLI that obfuscates or compiles your code: pass a file path (or pick files in a dialog), and get output as `<name>-secured.<ext>` or a binary. Language is auto-detected by extension or shebang.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Table of contents

- [Quick start](#quick-start)
- [Supported languages](#supported-languages)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Options](#options)
- [What it does](#what-it-does)
- [Validation and errors](#validation-and-errors)
- [How it works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

## Quick start

```bash
# From the repo
npm install && npm run build
node dist/cli.js samples/sample.js
# → writes samples/sample-secured.js

# With no arguments: opens a file picker (multi-select supported)
npm start
```

Global install: `npm install -g code-obfuscator`, then run `obfuscate path/to/file.js`. One-off without installing: `npx code-obfuscator path/to/file.js`.

## Supported languages

| Language   | Extensions                                      | How it's secured              |
|------------|--------------------------------------------------|-------------------------------|
| JavaScript | `.js`, `.mjs`, `.cjs`                           | Built-in obfuscator (Babel)   |
| TypeScript | `.ts`, `.mts`, `.cts`                           | Same as JavaScript            |
| Python     | `.py`                                           | PyArmor (prompted if missing) |
| Rust       | `.rs`                                           | `rustc` compile               |
| C          | `.c`, `.h`                                      | `gcc` compile                 |
| C++        | `.cpp`, `.cxx`, `.cc`, `.hpp`, `.hxx`           | `g++` compile                 |
| C#         | `.cs`                                           | `csc` / `dotnet`              |

Language can also be inferred from a shebang (e.g. `#!/usr/bin/env node`, `#!/usr/bin/env python3`). If a required external tool is missing, the app will prompt to install it when possible.

## Requirements

- **Node.js** ≥ 18
- For non–JS/TS languages, external tools are used and you are prompted to install them when needed:
  - **Python:** PyArmor (`pip install pyarmor`)
  - **Rust:** rustc (e.g. rustup)
  - **C/C++:** gcc/g++ (e.g. MSYS2 on Windows, build-essential on Linux)
  - **C#:** csc or .NET SDK

**Windows:** The CLI looks for gcc/g++ under MSYS2 (`C:\msys64\ucrt64\bin`, etc.). If the Rust MSVC linker is missing, it suggests switching to the GNU toolchain: `rustup default stable-x86_64-pc-windows-gnu`.

## Install

**Local (clone or download):**

```bash
npm install
npm run build
```

**Global (install the CLI):**

```bash
npm install -g code-obfuscator
```

Sample files are in `samples/` (e.g. `samples/sample.js`, `samples/sample.py`).

## Usage

```bash
# No arguments → open file picker, then write <name>-secured.<ext> or binary per file
npm start
# or: node dist/cli.js   or: obfuscate   or: npx code-obfuscator

# Single file (language from extension or shebang)
node dist/cli.js path/to/script.js
node dist/cli.js path/to/script.js -o out.js

# Multiple files: each gets its own output; Rust/C/C++ can compile multiple sources into one binary
node dist/cli.js main.rs mod.rs
node dist/cli.js file1.js file2.py

# Force language
node dist/cli.js path/to/file --lang javascript

# JS/TS only: disable renaming or string encoding
node dist/cli.js script.js --no-rename --no-encode-strings
```

### Options

| Option                 | Description |
|------------------------|-------------|
| `-o`, `--out <path>`   | Output file. Default: `<input>-secured.<ext>` or binary. With multiple inputs, only used when compiling Rust/C/C++ together into one binary. |
| `--lang <lang>`        | Force language: `javascript`, `typescript`, `python`, `rust`, `c`, `csharp`, `cpp`. |
| `--no-rename`          | (JS/TS only) Do not rename variables/functions. |
| `--no-encode-strings`  | (JS/TS only) Do not encode string literals. |
| `-h`, `--help`         | Show help. |

## What it does

- **JavaScript/TypeScript:** Renames identifiers (e.g. to `_0x4a2f`), encodes string literals as `atob("base64...")`, and minifies. Reserved names and property keys are left unchanged.
- **Python:** Runs PyArmor (`pyarmor gen`); prompts to install PyArmor if missing.
- **Rust / C / C++ / C#:** Compiles to a binary (`.exe` on Windows by default; use `-o` to choose the path). Prompts to install the compiler/SDK if missing. **Multi-file:** pass multiple source files (e.g. `obfuscate main.rs mod.rs`) to produce one binary. For C# with dotnet, the `.cs` file must be a console app with `static void Main`.

## Validation and errors

The CLI validates inputs and outputs and exits with clear messages when:

- **Input path is a directory** → `Error: path is a directory, not a file: <path>`
- **Output path is a directory** (when using `-o`) → `Error: output path is a directory, please specify a file path: <path>`
- **Language could not be detected** → Suggests using `--lang` or a supported extension.
- **JS/TS parse error** → `Failed to parse JavaScript/TypeScript: <details>`

## How it works

```
    +-------------+
    |    Start    |
    +------+------+
           |
           v
    +-------------+
    |  Parse argv |  (inputFile, -o, --lang, --no-rename, --no-encode-strings)
    +------+------+
           |
           v
    +------------------+     No      +------------------+
    | Input path given? |------------>| Open file picker | or exit
    +--------+---------+             +------------------+
           | Yes
           v
    +------------------+     No      +------------------+
    | File exists and  |------------>| File not found   |--> Exit 1
    | is a file?       |             +------------------+
    +--------+---------+
           | Yes
           v
    +------------------+
    | Detect language  |  (extension or shebang)
    +--------+---------+
           |
           v
    +------------------+     No      +------------------+
    | Language valid?  |------------>| Error, use --lang|--> Exit 1
    +--------+---------+             +------------------+
           | Yes
           v
    +---------------------------+
    | JS or TypeScript?          |
    +----+------------------+----+
        | Yes               | No (Python/Rust/C/C++/C#)
        v                   v
    +------------------------+   +------------------+
    | obfuscate()            |   | ensureDependency |--> runSecureCommand
    | - Parse → AST          |   +------------------+
    | - Rename ids           |
    | - Encode strings       |
    | - Minify               |
    +------------------------+
             |
             v
    +------------------+
    | Write to file    |  (<input>-secured.<ext> or binary, or -o path)
    +--------+---------+
             |
             v
         Exit 0
```

## Contributing

Open an issue or pull request. To test locally, run against files in `samples/` (e.g. `node dist/cli.js samples/sample.js`).

## License

MIT
