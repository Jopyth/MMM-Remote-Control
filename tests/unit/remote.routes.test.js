const assert = require("node:assert/strict");
const {describe, test} = require("node:test");
const path = require("node:path");

// Add tests/shims to module resolution
const ModuleLib = require("node:module");
const shimDir = path.resolve(__dirname, "../shims");
process.env.NODE_PATH = shimDir + (process.env.NODE_PATH ? path.delimiter + process.env.NODE_PATH : "");
if (typeof ModuleLib._initPaths === "function") ModuleLib._initPaths();

const helperFactory = require("../../node_helper.js");

function freshHelper () {
  const routes = {"get": new Map(), "post": new Map()};
  const helper = Object.create(helperFactory);
  helper.expressApp = {
    get: (route, handler) => {
      routes.get.set(route, handler);
    },
    post: (route, handler) => {
      routes.post.set(route, handler);
    }
  };
  helper.template = "<html></html>";
  helper.translation = {};
  helper.fillTemplates = helperFactory.fillTemplates.bind(helper);
  helper.translate = helperFactory.translate.bind(helper);
  return {helper, routes};
}

describe("createRoutes", () => {
  test("registers a root-scoped service worker route", () => {
    const {helper, routes} = freshHelper();
    helper.createRoutes = helperFactory.createRoutes.bind(helper);

    helper.createRoutes();

    const handler = routes.get.get("/remote-service-worker.js");
    assert.equal(typeof handler, "function");

    const res = {
      headers: {},
      set: (key, value) => {
        res.headers[key] = value;
      },
      contentType: (value) => {
        res.type = value;
      },
      sendFile: (value) => {
        res.file = value;
      }
    };

    handler({}, res);

    assert.equal(res.headers["Cache-Control"], "no-cache");
    assert.equal(res.type, "application/javascript");
    assert.equal(res.file, path.resolve(__dirname, "../../service-worker.js"));
  });
});
