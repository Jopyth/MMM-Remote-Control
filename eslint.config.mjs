import eslintPluginImport from "eslint-plugin-import";
import eslintPluginJs from "@eslint/js";
import globals from "globals";

const config = [
  eslintPluginImport.flatConfigs.recommended,
  eslintPluginJs.configs.recommended,
  {
    "ignores": ["**/*.min.js"]
  },
  {
    "files": ["**/*.js"],
    "languageOptions": {
      "globals": {
        ...globals.browser,
        ...globals.node,
        "$item": "writable",
        "$node": "writable"
      },
      "sourceType": "commonjs"
    },
    "rules": {
      "capitalized-comments": "off",
      "consistent-this": "off",
      "line-comment-position": "off",
      "max-lines-per-function": ["warn", 205],
      "max-statements": ["warn", 95],
      "multiline-comment-style": "off",
      "no-await-in-loop": "off",
      "no-constant-binary-expression": "warn",
      "no-inline-comments": "off",
      "no-magic-numbers": "off",
      "no-plusplus": "off",
      "no-prototype-builtins": "warn",
      "no-undef": "warn",
      "no-unused-vars": "warn",
      "no-useless-escape": "warn",
      "no-var": "warn",
      "one-var": "off",
      "sort-keys": "off",
      "strict": "off"
    }
  },
  {
    "files": ["**/*.mjs"],
    "languageOptions": {
      "ecmaVersion": "latest",
      "globals": {
        ...globals.node
      },
      "sourceType": "module"
    },
    "rules": {
      "func-style": "off",
      "max-lines-per-function": ["error", 100],
      "no-magic-numbers": "off",
      "one-var": "off",
      "prefer-destructuring": "off"
    }
  }
];

export default config;
