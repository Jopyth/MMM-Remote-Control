import {defineConfig, globalIgnores} from "eslint/config";
import css from "@eslint/css";
import globals from "globals";
import {flatConfigs as importX} from "eslint-plugin-import-x";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import pluginJsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";

export default defineConfig([
  globalIgnores(["**/*.min.js", "coverage/**"]),
  {"files": ["**/*.css"], "plugins": {css}, "language": "css/css", "extends": ["css/recommended"], "rules": {"css/use-baseline": "off"}},
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
    "plugins": {js, "jsdoc": pluginJsdoc, stylistic},
    "extends": [importX.recommended, pluginJsdoc.configs["flat/recommended"], "js/recommended", "stylistic/all", unicorn.configs.recommended],
    "rules": {
      "@stylistic/array-element-newline": ["error", "consistent"],
      "@stylistic/brace-style": ["error", "1tbs", {"allowSingleLine": true}],
      "@stylistic/function-call-argument-newline": ["error", "consistent"],
      "@stylistic/indent": ["error", 2],
      "@stylistic/multiline-ternary": "off",
      "@stylistic/newline-per-chained-call": "off",
      "@stylistic/no-extra-parens": "off",
      "@stylistic/object-property-newline": ["error", {"allowAllPropertiesOnSameLine": true}],
      "@stylistic/padded-blocks": "off",
      "@stylistic/quote-props": ["error", "consistent"],
      "capitalized-comments": "off",
      "jsdoc/require-jsdoc": [
        "error", {
          "require": {
            "FunctionDeclaration": true,
            "MethodDefinition": true,
            "ClassDeclaration": true,
            "ArrowFunctionExpression": false,
            "FunctionExpression": false
          }
        }
      ],
      "jsdoc/require-param": "error",
      "jsdoc/require-param-type": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-type": "error",
      "max-lines-per-function": ["warn", 250],
      "max-statements": ["warn", 60],
      "no-inline-comments": "off",
      "no-magic-numbers": "off",
      "no-var": "error",
      "one-var": "off",
      "sort-keys": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-null": "off",
      "unicorn/prefer-module": "off",
      "unicorn/prefer-query-selector": "off",
      "unicorn/prevent-abbreviations": "off",
      "unicorn/switch-case-braces": ["error", "avoid"]
    }
  },
  {
    "files": ["**/*.test.js"],
    "rules": {
      "jsdoc/require-jsdoc": "off"
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
    "extends": [importX.recommended, "js/all", "stylistic/all", unicorn.configs.recommended],
    "rules": {
      "@stylistic/array-element-newline": ["error", "consistent"],
      "@stylistic/indent": ["error", 2],
      "@stylistic/object-property-newline": ["error", {"allowAllPropertiesOnSameLine": true}],
      "import-x/no-unresolved": ["error", {"ignore": ["eslint/config"]}],
      "no-magic-numbers": "off",
      "sort-keys": "off",
      "unicorn/filename-case": "off"
    }
  },
  {"files": ["**/*.json"], "ignores": ["package-lock.json"], "plugins": {json}, "extends": ["json/recommended"], "language": "json/json"},
  {"files": ["**/*.md"], "plugins": {markdown}, "extends": ["markdown/recommended"], "language": "markdown/gfm"}
]);
