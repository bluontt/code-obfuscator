import * as parser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";
import type { ObfuscatorOptions } from "../options.js";

function randomName(prefix = "_0x"): string {
  const hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  return `${prefix}${hex}`;
}

function encodeStringLiteral(value: string): string {
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return encoded;
}

/**
 * Obfuscate JavaScript/TypeScript source: rename identifiers, encode strings, minify.
 */
export function obfuscateJavaScript(source: string, options: ObfuscatorOptions): string {
  const ast = parser.parse(source, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  const reserved = new Set(["undefined", "null", "true", "false", "this", "arguments", "super", "console", "window", "document", "global", "process", "require", "exports", "module"]);
  const renameMap = new WeakMap<object, string>();

  function getNameForBinding(identifier: t.Identifier): string {
    if (reserved.has(identifier.name)) return identifier.name;
    let name = renameMap.get(identifier);
    if (!name) {
      name = randomName();
      renameMap.set(identifier, name);
    }
    return name;
  }

  // First pass: scope-aware rename of bindings and their references
  if (options.rename) {
    traverse(ast, {
      Identifier(path: NodePath<t.Identifier>) {
        if (path.node.name.startsWith("_0x")) return;
        if (t.isMemberExpression(path.parent) && path.parent.property === path.node && !path.parent.computed) return;
        if (t.isObjectProperty(path.parent) && path.parent.key === path.node && !path.parent.computed) return;
        const binding = path.scope.getBinding(path.node.name);
        if (binding) {
          path.node.name = getNameForBinding(binding.identifier);
        }
      },
    });
  }

  // Second pass: encode string literals (only in JS we can use atob)
  if (options.encodeStrings) {
    traverse(ast, {
      StringLiteral(path: NodePath<t.StringLiteral>) {
        const value = path.node.value;
        if (value.length === 0) return;
        // Skip if already inside atob(...) to avoid double-encoding
        if (t.isCallExpression(path.parent) && t.isIdentifier(path.parent.callee) && path.parent.callee.name === "atob") return;
        const encoded = encodeStringLiteral(value);
        const call = t.callExpression(t.identifier("atob"), [t.stringLiteral(encoded)]);
        path.replaceWith(call);
      },
    });
  }

  const output = generate(ast, { compact: true, comments: false, retainLines: false });
  return output.code;
}
