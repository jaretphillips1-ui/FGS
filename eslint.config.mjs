import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,

  // Override default ignores of eslint-config-next + add our repo ignores
  globalIgnores([
    // Safety: ignore any accidental in-tree backups
    "**/*.bak.*",

    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // FGS: ignore our patch/backup folders so lint output stays clean
    ".patch_backups/**",
    "scripts/_bak/**",

    // JP ENGINE parity: also ignore EFSP-style patch backups if they ever appear here
    "scripts/_PATCH_BACKUPS/**",
  ]),
]);
