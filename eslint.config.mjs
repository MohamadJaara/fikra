import reactPlugin from "@eslint-react/eslint-plugin";
import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const reactHooksConfig = {
  name: "react-hooks/recommended",
  plugins: {
    "react-hooks": reactHooksPlugin,
  },
  rules: reactHooksPlugin.configs.recommended.rules,
};

export default tseslint.config(
  {
    ignores: [
      "convex/_generated/**",
      ".next/**",
      "node_modules/**",
      ".convex/**",
    ],
  },
  reactPlugin.configs["recommended-typescript"],
  nextPlugin.configs["core-web-vitals"],
  reactHooksConfig,
  ...tseslint.configs.recommended,
  {
    settings: {
      "eslint-react": {
        version: "detect",
      },
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowObjectTypes: "always" },
      ],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    rules: {
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    files: ["components/ui/**"],
    rules: {
      "@eslint-react/no-forward-ref": "off",
    },
  },
  {
    files: ["**/*.mjs"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
