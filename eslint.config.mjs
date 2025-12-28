import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  // 1) IGNORE GLOBALI
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "dist/**",
      "build/**",
      "next-env.d.ts",

      ".tekkin-analyzer-venv/**",
      ".tekkin-analyzer-venv-linux/**",
      "**/.venv/**",
      "**/venv/**",
      "**/__pycache__/**",
      "**/site-packages/**",
      "**/*.py",

      "eslint-report.json",
      "coverage/**",
      ".tmp/**",
      "tmp/**",

      ".env*",
      "*.local",
    ],
  },

  // 2) EXTENDS NEXT
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // 3) REGOLE GLOBALI
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-img-element": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 3) override API: qui ok
  {
    files: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // 5) UI + pagine: qui any è spesso inevitabile (Supabase rows, JSON, props dinamiche)
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  {
  files: ["lib/**/*.{ts,tsx}", "utils/**/*.{ts,tsx}"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
},


  // 4) regole globali (senza ignores qui)
];

export default eslintConfig;
