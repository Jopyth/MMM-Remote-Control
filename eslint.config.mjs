import {defineConfig, globalIgnores} from "eslint/config";
import pluginJsdoc, {configs as jsdocConfigs} from "eslint-plugin-jsdoc";
import css from "@eslint/css";
import globals from "globals";
import {flatConfigs as importX} from "eslint-plugin-import-x";
import js from "@eslint/js";
import json from "@eslint/json";
import markdown from "@eslint/markdown";
import stylistic from "@stylistic/eslint-plugin";
import unicorn from "eslint-plugin-unicorn";

const sharedGlobals = {
        ...globals.browser,
        ...globals.node,
        "$item": "writable",
        "$node": "writable"
    },

    sharedJsExtends = [
        importX.recommended,
        jsdocConfigs["flat/recommended"],
        "js/recommended",
        stylistic.configs.recommended,
        unicorn.configs.recommended
    ],

    sharedJsPlugins = {js,
        "jsdoc": pluginJsdoc},

    sharedJsRules = {
        "jsdoc/require-jsdoc": [
            "error",
            {
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
        "max-lines-per-function": [
            "warn",
            250
        ],
        "@stylistic/max-statements-per-line": [
            "error",
            {"max": 2}
        ],
        "max-statements": [
            "warn",
            60
        ],
        "no-var": "error",
        "unicorn/filename-case": "off",
        "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
        "unicorn/no-null": "off",
        "unicorn/prefer-module": "off",
        "unicorn/prefer-query-selector": "off",
        "unicorn/name-replacements": [
            "error",
            {"checkFilenames": false}
        ],
        "unicorn/switch-case-braces": [
            "error",
            "avoid"
        ]
    };

const config = defineConfig([
    globalIgnores([
        "**/*.min.js",
        "coverage/**"
    ]),
    {"files": ["**/*.css"],
        "plugins": {css},
        "language": "css/css",
        "extends": ["css/recommended"],
        "rules": {"css/use-baseline": "off"}},
    {
        "files": ["**/*.js"],
        "languageOptions": {"globals": {...sharedGlobals,
            "MMSocket": "readonly"}},
        "plugins": sharedJsPlugins,
        "extends": sharedJsExtends,
        "rules": sharedJsRules
    },
    {
        "files": ["tests/**/*.{js,mjs}"],
        "rules": {
            "unicorn/no-asterisk-prefix-in-documentation-comments": "off",
            "jsdoc/require-jsdoc": "off",
            "max-lines-per-function": "off",
            "unicorn/name-replacements": "off",
            "unicorn/no-global-object-property-assignment": "off",
            "unicorn/no-top-level-assignment-in-function": "off"
        }
    },
    {
        "files": ["tests/**/*.mjs"],
        "rules": {
            "class-methods-use-this": "off",
            "func-style": "off",
            "init-declarations": "off",
            "max-statements": "off",
            "no-empty-function": "off",
            "one-var": "off",
            "require-atomic-updates": "off"
        }
    },
    {
        "files": [
            "remote/remote.mjs",
            "remote/remote-*.mjs"
        ],
        "languageOptions": {"globals": sharedGlobals},
        "plugins": sharedJsPlugins,
        "extends": sharedJsExtends,
        "rules": {
            ...sharedJsRules,
            "unicorn/no-this-outside-of-class": "off"
        }
    },
    {
        "files": ["**/*.mjs"],
        "ignores": [
            "remote/remote.mjs",
            "remote/remote-*.mjs",
            "tests/**/*.mjs"
        ],
        "languageOptions": {
            "globals": {
                ...globals.browser,
                ...globals.node,
                "MMSocket": "readonly"
            }
        },
        "plugins": {js},
        "extends": [
            importX.recommended,
            "js/all",
            stylistic.configs.all,
            unicorn.configs.recommended
        ],
        "rules": {
            "import-x/no-unresolved": [
                "error",
                {"ignore": ["eslint/config"]}
            ],
            "no-magic-numbers": "off",
            "sort-keys": "off",
            "unicorn/filename-case": "off",
            "unicorn/name-replacements": [
                "error",
                {"checkFilenames": false}
            ]
        }
    },
    {
        "files": [
            "MMM-Remote-Control.js",
            "node_helper.js",
            "API/api.js"
        ],
        "rules": {
            "unicorn/no-this-outside-of-class": "off"
        }
    },
    {"files": ["**/*.json"],
        "ignores": ["package-lock.json"],
        "plugins": {json},
        "extends": ["json/recommended"],
        "language": "json/json"},
    {"files": ["docs/**/*.js"],
        "rules": {"unicorn/no-global-object-property-assignment": "off"}},
    {"files": ["**/*.md"],
        "plugins": {markdown},
        "extends": ["markdown/recommended"],
        "language": "markdown/gfm"},
    {
        "files": ["eslint.config.mjs"],
        "rules": {"one-var": "off"}
    }
]);

export default config;
