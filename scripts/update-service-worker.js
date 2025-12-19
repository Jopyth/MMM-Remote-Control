#!/usr/bin/env node

/**
 * Updates service-worker.js with current version from package.json
 */

const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.resolve(__dirname, "../package.json");
const serviceWorkerPath = path.resolve(__dirname, "../service-worker.js");

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const version = packageJson.version;

// Read service-worker.js
let serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");

// Update version in CACHE_NAME
const newCacheName = `mmm-remote-control-v${version}`;
serviceWorker = serviceWorker.replace(
  /const CACHE_NAME = "mmm-remote-control-v[\d.]+";/,
  `const CACHE_NAME = "${newCacheName}";`
);

// Write updated service-worker.js
fs.writeFileSync(serviceWorkerPath, serviceWorker, "utf8");

console.log(`✓ Service Worker cache updated to version ${version}`);
