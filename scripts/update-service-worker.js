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
const cacheNamePattern = /const CACHE_NAME = "mmm-remote-control-v[\d.]+";/u;
const currentCacheNameLine = serviceWorker.match(cacheNamePattern)?.[0];
if (currentCacheNameLine) {
  const updatedCacheNameLine = `const CACHE_NAME = "${newCacheName}";`;
  serviceWorker = serviceWorker.split(currentCacheNameLine).join(updatedCacheNameLine);
}

// Write updated service-worker.js
fs.writeFileSync(serviceWorkerPath, serviceWorker, "utf8");

console.log(`✓ Service Worker cache updated to version ${version}`);
