import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

const __FGS_BASE_CONFIG__ = eslintConfig;
const __FGS_CONFIG_ARRAY__ = (Array.isArray(__FGS_BASE_CONFIG__) ? __FGS_BASE_CONFIG__.flat() : [__FGS_BASE_CONFIG__]);

const __FGS_EXPORT__ = [
{ ignores: ["scripts/_bak/**"] },
  ...__FGS_CONFIG_ARRAY__,
];

export default __FGS_EXPORT__;
