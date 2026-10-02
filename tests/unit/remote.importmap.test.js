const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {describe, test} = require("node:test");

describe("basePath-safe remote asset paths", () => {
  test("uses valid relative import-map URLs for browser ESM deps", () => {
    const remoteHtmlPath = path.resolve(__dirname, "../../remote.html");
    const html = fs.readFileSync(remoteHtmlPath, "utf8");
    const markedMatch = html.match(/"marked"\s*:\s*"([^"]+)"/);
    const dompurifyMatch = html.match(/"dompurify"\s*:\s*"([^"]+)"/);

    assert.ok(markedMatch, "Expected a marked entry in the import map");
    assert.equal(markedMatch[1], "./modules/MMM-Remote-Control/node_modules/marked/lib/marked.esm.js");

    assert.ok(dompurifyMatch, "Expected a dompurify entry in the import map");
    assert.equal(
      dompurifyMatch[1],
      "./modules/MMM-Remote-Control/node_modules/dompurify/dist/purify.es.mjs"
    );
  });

  test("manifest uses paths relative to the MagicMirror basePath", () => {
    const manifestPath = path.resolve(__dirname, "../../manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert.equal(manifest.start_url, "../../remote.html");
    assert.equal(manifest.scope, "../../");
  });

  test("service worker is registered from the remote root scope", () => {
    const remoteMjsPath = path.resolve(__dirname, "../../remote/remote.mjs");
    const remoteMjs = fs.readFileSync(remoteMjsPath, "utf8");

    assert.match(remoteMjs, /navigator\.serviceWorker\.register\(\s*"\.\/remote-service-worker\.js"/);
    assert.match(remoteMjs, /\{\s*"scope":\s*"\.\/"\s*\}/);
  });

  test("service worker precache list avoids root-absolute URLs", () => {
    const serviceWorkerPath = path.resolve(__dirname, "../../service-worker.js");
    const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");
    const matches = serviceWorker.matchAll(/"([^"\n]+)"/g).toArray();
    const urls = matches.map((match) => match[1]).filter((value) => value.startsWith("./") || value.startsWith("/"));

    assert.ok(urls.includes("./remote.html"));
    assert.equal(urls.some((value) => value.startsWith("/")), false);
  });

  test("service worker cache name matches the package version", () => {
    const serviceWorker = fs.readFileSync(path.resolve(__dirname, "../../service-worker.js"), "utf8");
    const {version} = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../package.json"), "utf8"));

    assert.match(serviceWorker, new RegExp(`const CACHE_NAME = "mmm-remote-control-v${version.replaceAll(".", String.raw`\.`)}";`));
  });

  test("service worker cache list covers every remote module and import-map target", () => {
    const serviceWorker = fs.readFileSync(path.resolve(__dirname, "../../service-worker.js"), "utf8");
    const html = fs.readFileSync(path.resolve(__dirname, "../../remote.html"), "utf8");
    const remoteFiles = fs.readdirSync(path.resolve(__dirname, "../../remote")).
      filter((file) => file.endsWith(".mjs")).
      map((file) => `./modules/MMM-Remote-Control/remote/${file}`);
    const importMapTargets = html.matchAll(/"(\.\/modules\/MMM-Remote-Control\/node_modules\/[^"]+)"/g).map((match) => match[1]);

    for (const url of [...remoteFiles, ...importMapTargets]) {
      assert.ok(serviceWorker.includes(`"${url}"`), `${url} is missing from the service worker precache list`);
    }
  });
});
