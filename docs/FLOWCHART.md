# Code Obfuscator — How It Works

Flow from CLI to obfuscated output:

```mermaid
flowchart TB
    subgraph CLI["CLI (cli.js)"]
        A([Start]) --> B[Parse argv]
        B --> C{Input path given?}
        C -->|No| D[Print error + usage]
        D --> E([Exit 1])
        C -->|Yes| F[Resolve path]
        F --> G{File exists?}
        G -->|No| H[Print file not found]
        H --> E
        G -->|Yes| I{--lang provided?}
        I -->|Yes| J[Use override language]
        I -->|No| K[Detect language]
        K --> L[Extension or shebang]
        J --> M{Language valid?}
        L --> M
        M -->|No| N[Print error]
        N --> E
        M -->|Yes| O[Read file → source]
        O --> P[obfuscate(source, lang, options)]
    end

    subgraph Detect["detect.ts"]
        L --> L1[EXT_MAP: .js/.mjs/.cjs → js, .ts/.mts/.cts → ts, .py → py]
        L1 --> L2{Extension match?}
        L2 -->|Yes| L3[Return lang]
        L2 -->|No| L4[Read first line, parse shebang]
        L4 --> L5[SHEBANG_MAP: node→js, python→py]
        L5 --> L3
    end

    subgraph Obfuscate["obfuscators/index.ts"]
        P --> Q{lang?}
        Q -->|javascript / typescript| R[obfuscateJavaScript]
        Q -->|python| S[Throw not implemented]
        Q -->|other| T[Throw unsupported]
        R --> U[Return code string]
    end

    subgraph JS["obfuscators/javascript.ts"]
        R --> R1[Parse source → AST]
        R1 --> R2{options.rename?}
        R2 -->|Yes| R3[Traverse AST: rename bindings to _0xXXXXXX]
        R2 -->|No| R4
        R3 --> R4{options.encodeStrings?}
        R4 -->|Yes| R5[Traverse AST: replace string literals with atob(base64)]
        R4 -->|No| R6
        R5 --> R6[Generate code]
        R6 --> R7{options.minify?}
        R7 -->|Yes| R8[Compact, no comments]
        R7 -->|No| R9[Keep comments, retain lines]
        R8 --> R10[Return output code]
        R9 --> R10
    end

    U --> V{--out path?}
    V -->|Yes| W[Write to file, log]
    V -->|No| X[stdout.write]
    W --> Y([Exit 0])
    X --> Y
```

## Steps in short

| Step | Where | What |
|------|--------|------|
| 1 | CLI | Parse args: `inputFile`, `-o/--out`, `--lang`, `--no-rename`, `--no-encode-strings` |
| 2 | CLI | Validate input path and that file exists |
| 3 | detect.ts | Language = extension (.js/.ts/.py etc.) or shebang (#!node / #!python) |
| 4 | CLI | Read file contents |
| 5 | index.ts | Dispatch by language → JS/TS → `obfuscateJavaScript`; Python → error |
| 6 | javascript.ts | Parse with Babel → AST |
| 7 | javascript.ts | Optionally rename identifiers (scope-aware, reserved names kept) |
| 8 | javascript.ts | Optionally replace string literals with `atob("base64...")` |
| 9 | javascript.ts | Babel generate: always minified (compact, no comments) |
| 10 | CLI | Write to `--out` file or stdout |

## Options (options.ts)

- **rename**: variables/functions → `_0x` + 6 random hex (reserved names unchanged)
- **encodeStrings**: string literals → `atob("base64...")`
- **minify**: always on (compact output, no comments)
