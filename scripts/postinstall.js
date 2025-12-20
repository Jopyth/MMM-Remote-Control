#!/usr/bin/env node

/**
 * Cross-platform postinstall script
 * Copies modules.json.template to modules.json if it doesn't exist yet
 */

const fs = require("node:fs");
const path = require("node:path");
const {v4: uuid} = require("uuid");

const moduleDir = path.resolve(__dirname, "..");
const modulesSourceFile = path.join(moduleDir, "modules.json.template");
const modulesTargetFile = path.join(moduleDir, "modules.json");

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
  const apiKey = uuid();
  console.log("\n\u001B[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001B[0m");
  console.log("\u001B[1m Sample API key for your config.js:\u001B[0m");
  console.log("\u001B[33m  apiKey: \"" + apiKey + "\"\u001B[0m");
  console.log("\u001B[2m (Optional - or use 'npm run generate-apikey' anytime)\u001B[0m");
  console.log("\u001B[1m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\u001B[0m\n");

  process.exit(0);
} catch (error) {
  console.error("Error during postinstall:", error.message);
  process.exit(1);
}
