import {defineConfig, globalIgnores} from "eslint/config";
import css from "@eslint/css";
import globals from "globals";
import {flatConfigs as importX} from "eslint-plugin-import-x";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import stylistic from "@stylistic/eslint-plugin";

export default defineConfig([
  globalIgnores(["**/*.min.js"]),
  {"files": ["**/*.css"], "languageOptions": {"tolerant": true}, "plugins": {css}, "language": "css/css", "extends": ["css/recommended"], "rules": {"css/use-baseline": ["error", {"available": "newly"}]}},
  {
    "files": ["**/*.js"],
    "languageOptions": {
      "ecmaVersion": "latest",
      "globals": {
        ...globals.browser,
        ...globals.node,
        "$item": "writable",
        "$node": "writable"
      }
    },
    "plugins": {js, stylistic},
    "extends": [importX.recommended, "js/recommended", "stylistic/all"],
    "rules": {
      "@stylistic/array-element-newline": ["error", "consistent"],
      "@stylistic/brace-style": ["error", "1tbs", {"allowSingleLine": true}],
      "@stylistic/function-call-argument-newline": "off",
      "@stylistic/indent": ["error", 2],
      "@stylistic/multiline-ternary": "off",
      "@stylistic/newline-per-chained-call": "off",
      "@stylistic/object-property-newline": "off",
      "@stylistic/padded-blocks": "off",
      "@stylistic/quote-props": ["error", "consistent"],
      "capitalized-comments": "off",
      "consistent-this": "off",
      "line-comment-position": "off",
      "max-lines-per-function": ["warn", 250],
      "max-statements": ["warn", 105],
      "multiline-comment-style": "off",
      "no-await-in-loop": "off",
      "no-inline-comments": "off",
      "no-magic-numbers": "off",
      "no-var": "error",
      "one-var": "off",
      "prefer-const": "error",
      "prefer-template": "error",
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
    "plugins": {js, stylistic},
    "extends": [importX.recommended, "js/all", "stylistic/all"],
    "rules": {
      "@stylistic/array-element-newline": ["error", "consistent"],
      "@stylistic/indent": ["error", 2],
      "@stylistic/object-property-newline": ["error", {"allowAllPropertiesOnSameLine": true}],
      "import-x/no-unresolved": ["error", {"ignore": ["eslint/config"]}],
      "no-magic-numbers": "off",
      "sort-keys": "off"
    }
  },
  {"files": ["**/*.json"], "ignores": ["package-lock.json"], "plugins": {json}, "extends": ["json/recommended"], "language": "json/json"},
  {"files": ["**/*.md"], "plugins": {markdown}, "extends": ["markdown/recommended"], "language": "markdown/gfm"}
]);
