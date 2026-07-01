#!/usr/bin/env node

/**
 * Cross-platform postinstall script
 * Copies modules.json.template to modules.json if it doesn't exist yet
 */

const fs = require("node:fs");
const path = require("node:path");
const {randomUUID} = require("node:crypto");

const moduleDirectory = path.resolve(__dirname, "..");
const modulesSourceFile = path.join(moduleDirectory, "modules.json.template");
const modulesTargetFile = path.join(moduleDirectory, "modules.json");

try {
  // Check if modules.json already exists
  if (fs.existsSync(modulesTargetFile)) {
    console.log("modules.json already exists, skipping copy.");
  } else {
    // Copy template to target
    fs.copyFileSync(modulesSourceFile, modulesTargetFile);
    console.log("Successfully created modules.json from template.");
  }

  // Always generate and display a fresh API key
  const apiKey = randomUUID();
  console.log("\n\u{1B}[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u{1B}[0m");
  console.log("\u{1B}[1m Sample API key for your config.js:\u{1B}[0m");
  console.log("\u{1B}[33m  apiKey: \"" + apiKey + "\"\u{1B}[0m");
  console.log("\u{1B}[2m (Optional - or use 'node --run generate-apikey' anytime)\u{1B}[0m");
  console.log("\u{1B}[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u{1B}[0m\n");

  process.exit(0);
} catch (error) {
  console.error("Error during postinstall:", error.message);
  process.exit(1);
}
