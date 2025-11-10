#!/usr/bin/env node

/**
 * Cross-platform postinstall script
 * Copies modules.json.template to modules.json if it doesn't exist yet
 */

const fs = require("node:fs");
const path = require("node:path");

const sourceFile = path.resolve(__dirname, "..", "modules.json.template");
const targetFile = path.resolve(__dirname, "..", "modules.json");

try {
  // Check if target file already exists
  if (fs.existsSync(targetFile)) {
    console.log("modules.json already exists, skipping copy.");
    process.exit(0);
  }

  // Copy template to target
  fs.copyFileSync(sourceFile, targetFile);
  console.log("Successfully created modules.json from template.");
  process.exit(0);
} catch (error) {
  console.error("Error during postinstall:", error.message);
  process.exit(1);
}
