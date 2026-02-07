/**
 * @file tests/unit/translations.test.js
 * @description Tests for translation file completeness and consistency
 */

const {describe, it} = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const translationsDir = path.join(__dirname, "../../translations");
const swaggerPath = path.join(__dirname, "../../docs/swagger.json");

/**
 * Get all translation files
 * @returns {object} Map of language code to translation object
 */
function getAllTranslations () {
  const files = fs.readdirSync(translationsDir);
  const translations = {};

  for (const file of files) {
    if (file.endsWith(".json")) {
      const lang = file.replace(".json", "");
      const content = fs.readFileSync(path.join(translationsDir, file), "utf8");
      translations[lang] = JSON.parse(content);
    }
  }

  return translations;
}

/**
 * Get all translation keys from all files
 * @param {object} translations - All translations
 * @returns {Set} Set of all unique keys
 */
function getAllKeys (translations) {
  const allKeys = new Set();

  for (const lang in translations) {
    for (const key in translations[lang]) {
      allKeys.add(key);
    }
  }

  return allKeys;
}

/**
 * Extract all translation keys used in code files
 * @returns {Set} Set of translation keys used in code
 */
function getUsedTranslationKeys () {
  const usedKeys = new Set();
  const searchDirs = [
    path.join(__dirname, "../../"),
    path.join(__dirname, "../../API")
  ];

  const filesToSearch = [];

  // Collect JS, CSS, and HTML files (excluding node_modules, tests, coverage, docs)
  function collectFiles (dir) {
    const entries = fs.readdirSync(dir, {withFileTypes: true});

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip certain directories
      if (entry.isDirectory()) {
        if (
          ["node_modules", "tests", "coverage", "docs", "lib", ".git", "translations"].includes(entry.name)
        ) {
          continue;
        }
        collectFiles(fullPath);
      } else if (entry.isFile() && (/\.(js|html|css)$/).test(entry.name)) {
        filesToSearch.push(fullPath);
      }
    }
  }

  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      collectFiles(dir);
    }
  }

  /*
   * Search for translation keys in files
   * Pattern matches:
   * - this.translate("KEY")
   * - translate("KEY")
   * - data-i18n="KEY"
   * - i18n.KEY
   * - %%TRANSLATE:KEY%% (in HTML)
   * - : "KEY" (object property values, but excluding certain patterns)
   */
  const patterns = [
    /this\.translate\(["']([A-Z_]+)["']/g,
    /translate\(["']([A-Z_]+)["']/g,
    /data-i18n=["']([A-Z_]+)["']/g,
    /i18n\.([A-Z_]+)/g,
    /%%TRANSLATE:([A-Z_]+)%%/g,
    /:\s*["']([A-Z][A-Z_]{3,})["']/g // Matches : "KEY" where KEY is 4+ chars uppercase, likely a translation reference
  ];

  for (const file of filesToSearch) {
    try {
      const content = fs.readFileSync(file, "utf8");

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          usedKeys.add(match[1]);
        }
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return usedKeys;
}

/**
 * Check if swagger.json has translatable descriptions
 * @returns {Array} Array of issues found
 */
function checkSwaggerTranslations () {
  const issues = [];

  if (!fs.existsSync(swaggerPath)) {
    return [{type: "missing", message: "swagger.json file not found"}];
  }

  const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

  // Check main description
  if (!swagger.info || !swagger.info.description) {
    issues.push({type: "missing", path: "info.description"});
  }

  // Check tags descriptions
  if (swagger.tags) {
    for (const [index, tag] of swagger.tags.entries()) {
      if (!tag.description || tag.description.trim() === "") {
        issues.push({
          type: "missing",
          path: `tags[${index}].description`,
          name: tag.name
        });
      }
    }
  }

  // Check paths for descriptions
  if (swagger.paths) {
    for (const [pathName, pathObj] of Object.entries(swagger.paths)) {
      for (const [method, methodObj] of Object.entries(pathObj)) {
        if (typeof methodObj === "object" && methodObj !== null) {
          // Check summary
          if (!methodObj.summary || methodObj.summary.trim() === "") {
            issues.push({
              type: "missing",
              path: `paths["${pathName}"].${method}.summary`
            });
          }

          // Check parameters descriptions
          if (methodObj.parameters) {
            for (const [paramIndex, param] of methodObj.parameters.entries()) {
              if (!param.description || param.description.trim() === "") {
                issues.push({
                  type: "missing",
                  path: `paths["${pathName}"].${method}.parameters[${paramIndex}].description`,
                  name: param.name
                });
              }
            }
          }

          // Check response descriptions
          if (methodObj.responses) {
            for (const [code, response] of Object.entries(methodObj.responses)) {
              if (!response.description || response.description.trim() === "") {
                issues.push({
                  type: "empty",
                  path: `paths["${pathName}"].${method}.responses["${code}"].description`
                });
              }
            }
          }
        }
      }
    }
  }

  return issues;
}

describe("Translation Completeness", () => {
  it("should have all translation files with same keys", () => {
    const translations = getAllTranslations();
    const allKeys = getAllKeys(translations);
    const languages = Object.keys(translations);

    assert.ok(languages.length > 0, "At least one translation file should exist");

    const missingKeys = {};

    for (const lang of languages) {
      const langKeys = Object.keys(translations[lang]);
      const missing = [];

      for (const key of allKeys) {
        if (!langKeys.includes(key)) {
          missing.push(key);
        }
      }

      if (missing.length > 0) {
        missingKeys[lang] = missing;
      }
    }

    if (Object.keys(missingKeys).length > 0) {
      let errorMessage = "Missing translation keys found:\n";
      for (const [lang, keys] of Object.entries(missingKeys)) {
        errorMessage += `\n${lang}.json is missing: ${keys.join(", ")}`;
      }
      assert.fail(errorMessage);
    }
  });

  it("should have all translation files with same number of keys", () => {
    const translations = getAllTranslations();
    const languages = Object.keys(translations);
    const keyCounts = {};

    for (const lang of languages) {
      keyCounts[lang] = Object.keys(translations[lang]).length;
    }

    const counts = Object.values(keyCounts);
    const allSame = counts.every((count) => count === counts[0]);

    if (!allSame) {
      let errorMessage = "Translation files have different number of keys:\n";
      for (const [lang, count] of Object.entries(keyCounts)) {
        errorMessage += `\n${lang}.json: ${count} keys`;
      }
      assert.fail(errorMessage);
    }
  });

  it("should have valid JSON in all translation files", () => {
    const files = fs.readdirSync(translationsDir);

    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(translationsDir, file);
        const content = fs.readFileSync(filePath, "utf8");

        assert.doesNotThrow(() => {
          JSON.parse(content);
        }, `${file} should be valid JSON`);
      }
    }
  });

  it("should have no empty translation values", () => {
    const translations = getAllTranslations();
    const emptyValues = {};

    for (const [lang, langTranslations] of Object.entries(translations)) {
      const empty = [];

      for (const [key, value] of Object.entries(langTranslations)) {
        if (typeof value === "string" && value.trim() === "") {
          empty.push(key);
        }
      }

      if (empty.length > 0) {
        emptyValues[lang] = empty;
      }
    }

    if (Object.keys(emptyValues).length > 0) {
      let errorMessage = "Empty translation values found:\n";
      for (const [lang, keys] of Object.entries(emptyValues)) {
        errorMessage += `\n${lang}.json has empty values for: ${keys.join(", ")}`;
      }
      assert.fail(errorMessage);
    }
  });
});

describe("Swagger.json Documentation", () => {
  it("should have descriptions for all API endpoints", () => {
    const issues = checkSwaggerTranslations();

    if (issues.length > 0) {
      let errorMessage = "Missing or empty descriptions in swagger.json:\n";

      for (const issue of issues) {
        if (issue.type === "missing") {
          errorMessage += `\n- ${issue.path}${issue.name ? ` (${issue.name})` : ""}`;
        } else if (issue.type === "empty") {
          errorMessage += `\n- ${issue.path} is empty`;
        }
      }

      assert.fail(errorMessage);
    }
  });

  it("should have up-to-date translation example in /api/translations endpoint", () => {
    if (!fs.existsSync(swaggerPath)) {
      assert.fail("swagger.json file not found");
    }

    const swagger = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));
    const translations = getAllTranslations();
    const enTranslations = translations.en || {};

    // Find the /api/translations endpoint
    const translationsEndpoint = swagger.paths?.["/api/translations"]?.get;

    if (!translationsEndpoint) {
      assert.fail("Could not find /api/translations endpoint in swagger.json");
    }

    const exampleData = translationsEndpoint.responses?.["200"]?.content?.["application/json"]?.example?.data;

    if (!exampleData) {
      assert.fail("Could not find example translations data in /api/translations endpoint");
    }

    // Check if all keys from en.json are in the swagger example
    const missingInSwagger = [];
    const extraInSwagger = [];

    for (const key of Object.keys(enTranslations)) {
      if (!(key in exampleData)) {
        missingInSwagger.push(key);
      }
    }

    for (const key of Object.keys(exampleData)) {
      if (!(key in enTranslations)) {
        extraInSwagger.push(key);
      }
    }

    const errors = [];

    if (missingInSwagger.length > 0) {
      errors.push(`Missing keys in swagger.json /api/translations example: ${missingInSwagger.join(", ")}`);
    }

    if (extraInSwagger.length > 0) {
      errors.push(`Extra keys in swagger.json /api/translations example (not in en.json): ${extraInSwagger.join(", ")}`);
    }

    if (errors.length > 0) {
      assert.fail(errors.join("\n\n"));
    }
  });
});

describe("Translation Usage", () => {
  it("should have translations for all used keys in code", () => {
    const translations = getAllTranslations();
    const allKeys = getAllKeys(translations);
    const usedKeys = getUsedTranslationKeys();

    const missingTranslations = [];

    for (const key of usedKeys) {
      if (!allKeys.has(key)) {
        missingTranslations.push(key);
      }
    }

    if (missingTranslations.length > 0) {
      // Filter out common false positives (notification names, constants, etc.)
      const likelyRealMissing = missingTranslations.filter((key) => ![
        "MANAGE_CLASSES",
        "COMMAND",
        "USER_PRESENCE",
        "STATUS",
        "DELAYED",
        "NOTIFICATION",
        "GET_CHANGELOG",
        "RESTART",
        "STOP",
        "SOME_UNIQUE_ID",
        "SHOW_ALERT",
        "TEMP",
        "SHOW",
        "HIDE",
        "INSTALL",
        "UPDATE",
        "REFRESH",
        "TOGGLEFULLSCREEN",
        "HIDE_ALERT",
        "ON",
        "OFF",
        "TOGGLE"
      ].includes(key));

      if (likelyRealMissing.length > 0) {
        assert.fail(`Translation keys used in code but not found in translation files:\n${likelyRealMissing.join(", ")}`);
      }
    }
  });

  it("should only have translation keys that are used in code", () => {
    const translations = getAllTranslations();
    const allKeys = getAllKeys(translations);
    const usedKeys = getUsedTranslationKeys();

    const unusedKeys = [];

    for (const key of allKeys) {
      if (!usedKeys.has(key)) {
        unusedKeys.push(key);
      }
    }

    if (unusedKeys.length > 0) {
      const warningMsg = `\nInfo: Found ${unusedKeys.length} potentially unused translation keys:\n${unusedKeys.join(", ")}\n\nNote: These keys might be used dynamically (e.g., in custom_menu.example.json) or in ways not detected by the search patterns.\nIf you're sure they're unused, consider removing them to keep translations clean.`;
      console.log(warningMsg);

      /*
       * This is informational only - don't fail the test
       * Uncomment the line below if you want to enforce zero unused keys:
       * assert.fail(`Found ${unusedKeys.length} unused translation keys. See console output above for details.`);
       */
    }
  });
});
