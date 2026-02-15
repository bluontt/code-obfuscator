# code-obfuscator

CLI to obfuscate or compile code. Pick a file or pass a path; output is written to `<name>-secured.<ext>` or a binary.

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)

## Table of contents

- [Supported languages](#supported-languages)
- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Options](#options)
- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Contributing](#contributing)
- [License](#license)

## Supported languages

| Language    | Extensions                    | How it's secured        |
|-------------|-------------------------------|--------------------------|
| JavaScript  | `.js`, `.mjs`, `.cjs`         | Built-in obfuscator      |
| TypeScript  | `.ts`, `.mts`, `.cts`         | Same as JavaScript       |
| Python      | `.py`                         | PyArmor (optional install) |
| Rust        | `.rs`                         | `rustc` compile          |
| C           | `.c`, `.h`                    | `gcc` compile            |
| C++         | `.cpp`, `.cxx`, `.cc`, `.hpp`, `.hxx` | `g++` compile   |
| C#          | `.cs`                         | `csc` / `dotnet`         |

If a required tool is missing, the app will prompt to install it (where possible).

## Requirements

- **Node.js** >= 18
- For non–JavaScript/TypeScript languages, external tools (PyArmor, rustc, gcc/g++, dotnet) are used; you are prompted to install them when needed.

**Windows:** The CLI looks for gcc/g++ under MSYS2 (`C:\msys64\ucrt64\bin`, etc.) so you don't need them on system PATH. If the Rust MSVC linker is missing, it will suggest switching to the GNU toolchain (`rustup default stable-x86_64-pc-windows-gnu`).

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

After a global install, the `obfuscate` command is available. For a one-off run without installing: `npx code-obfuscator <file>`.

Sample files for testing are in the `samples/` folder (e.g. `node dist/cli.js samples/sample.js`).

## Usage

```bash
# With no arguments: open file picker (multi-select supported), then write <name>-secured.<ext> or binary per file
npm start
# or: node dist/cli.js   or: obfuscate   or: npx code-obfuscator

# Pass one or more file paths (language auto-detected by extension or shebang)
node dist/cli.js path/to/script.js
node dist/cli.js path/to/script.js -o out.js

# Multiple files: each gets its own output; or (Rust/C/C++ only) pass multiple sources to build one binary
node dist/cli.js main.rs mod.rs
node dist/cli.js file1.js file2.py

# With global install
obfuscate path/to/script.js
obfuscate path/to/script.js -o out.js

# Force language
node dist/cli.js path/to/file --lang javascript

# JS/TS only: disable obfuscation features
node dist/cli.js script.js --no-rename --no-encode-strings
```

### Options

| Option                 | Description |
|------------------------|-------------|
| `-o`, `--out <path>`   | Output file (default: `<input>-secured.<ext>` or binary). With multiple inputs, only used when compiling Rust/C/C++ together. |
| `--lang <lang>`        | Force language: `javascript`, `typescript`, `python`, `rust`, `c`, `csharp`, `cpp` |
| `--no-rename`          | (JS/TS) Do not rename variables/functions |
| `--no-encode-strings`  | (JS/TS) Do not encode string literals |
| `-h`, `--help`         | Show help |

## What it does

- **JavaScript/TypeScript:** Renames identifiers (e.g. `_0x4a2f`), encodes strings as `atob("base64...")`, and always minifies output. Reserved names and property keys are unchanged.
- **Python:** Runs PyArmor (`pyarmor gen`) to obfuscate; prompts to install if missing.
- **Rust / C / C++ / C#:** Compiles to a binary (on Windows the default extension is `.exe`; use `-o` to choose another name). Prompts to install compiler/SDK if missing. On Windows, C/C++ use gcc/g++ from MSYS2 when available. **Multi-file projects:** pass multiple source files (e.g. `obfuscate main.rs mod.rs`) to produce one binary; the file picker also supports selecting multiple files. For C# with dotnet, the `.cs` file should be a console app with a `static void Main` entry point.

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
    | Input path given? |------------>| Error + usage    |--> Exit 1
    +--------+---------+             +------------------+
           | Yes
           v
    +-------------+     No      +------------------+
    | File exists?|------------>| File not found    |--> Exit 1
    +------+------+             +------------------+
           | Yes
           v
    +------------------+
    | Detect language  |  (extension .js/.ts/.py etc. or shebang #!node / #!python)
    +--------+---------+
           |
           v
    +------------------+     No      +------------------+
    | Language valid?  |------------>| Error, use --lang|--> Exit 1
    +--------+---------+             +------------------+
           | Yes
           v
    +-------------+
    | Read file   |
    +------+------+
           |
           v
    +---------------------------+
    | JS or TypeScript?          |
    +----+------------------+----+
        | Yes               | No (Python/Rust/C/C++/C#)
        v                   v
    +------------------------+   +------------------+
    | obfuscate()            |   | ensureDependency |--> runSecureCommand (pyarmor/rustc/gcc/dotnet)
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

Open an issue or pull request.

## License

MIT
