export interface ObfuscatorOptions {
  /** Rename variables and functions to short random names */
  rename: boolean;
  /** Encode string literals (e.g. base64 or hex) */
  encodeStrings: boolean;
}

export const DEFAULT_OPTIONS: ObfuscatorOptions = {
  rename: true,
  encodeStrings: true,
};
