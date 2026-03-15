const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {describe, test} = require("node:test");

describe("basePath-safe remote asset paths", () => {
  test("uses a valid relative import-map URL for marked", () => {
    const remoteHtmlPath = path.resolve(__dirname, "../../remote.html");
    const html = fs.readFileSync(remoteHtmlPath, "utf8");
    const match = html.match(/"marked"\s*:\s*"([^"]+)"/);

    assert.ok(match, "Expected a marked entry in the import map");
    assert.equal(match[1], "./modules/MMM-Remote-Control/node_modules/marked/lib/marked.esm.js");
  });

  test("manifest uses paths relative to the MagicMirror basePath", () => {
    const manifestPath = path.resolve(__dirname, "../../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert.equal(manifest.start_url, "../../remote.html");
    assert.equal(manifest.scope, "../../");
  });

  test("service worker is registered from the remote root scope", () => {
    const remoteMjsPath = path.resolve(__dirname, "../../remote.mjs");
    const remoteMjs = fs.readFileSync(remoteMjsPath, "utf8");

    assert.match(remoteMjs, /navigator\.serviceWorker\.register\(\s*"\.\/remote-service-worker\.js"/);
    assert.match(remoteMjs, /\{\s*"scope":\s*"\.\/"\s*\}/);
  });

  test("service worker precache list avoids root-absolute URLs", () => {
    const serviceWorkerPath = path.resolve(__dirname, "../../service-worker.js");
    const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");
    const matches = [...serviceWorker.matchAll(/"([^"\n]+)"/g)];
    const urls = matches.map((match) => match[1]).filter((value) => value.startsWith("./") || value.startsWith("/"));

    assert.ok(urls.includes("./remote.html"));
    assert.equal(urls.some((value) => value.startsWith("/")), false);
  });
});
