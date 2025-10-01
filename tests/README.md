# Tests

This project uses Node's built-in test runner and c8 for coverage.

Quick run:

- Lint & format check: `node --run lint`
- Unit tests: `node --run test:unit`
- Coverage: `node --run test:coverage`

Guidelines:

- Keep tests side-effect free; mock/bypass filesystem, network, and timers.
- For API helpers in `API/api.js`, bind functions to a fake context rather than spinning an Express server.
- For `node_helper.js` paths, test logic by stubbing methods (e.g., `sendSocketNotification`, `sendResponse`) and, when necessary, mock timers.
- Follow repository lint rules; keep arrays/objects on one line where stylistic rules require it.

Notes on shims used in tests:

- We provide lightweight shims under `tests/shims/` (e.g., `logger.js`, `node_helper.js`) to isolate unit tests from MagicMirror core. When a test needs to load `node_helper.js`, inject the shim path via `NODE_PATH` and call `module._initPaths()` before requiring the target file.

Status checkpoint (2025-09-21):

- Phases 1 and 2 completed. We added unit tests for API helpers (`checkDelay`, `answerNotifyApi`), `answerModuleApi` defaults and SHOW flow, and timer behavior for `delayedQuery`.
- Introduced shims for `logger` and `node_helper` so `node_helper.js` can be required in tests without MagicMirror runtime.
- Phase 3 router-level GET coverage added; one direct `answerGet` unit test remains skipped and is deferred to a later phase once NodeHelper/MM core is further isolated.

## Test Roadmap (Phases)

The project follows an incremental test roadmap. Coverage thresholds start low and rise as we add tests.

1. Phase 1 — Base quality gates (Done)
   - Lint, formatter, spellcheck wired; no runtime tests.
2. Phase 2 — Test runner & utilities (Done)
   - Test runner configured, first unit tests added, coverage baseline established.
3. Phase 3 — More unit & first integration tests (Done)
   - Extra edge cases for `cleanConfig` (Done)
   - GET routes covered at router level (Done)
   - Small express/test factory (mocks: fs, simple-git) (Deferred)
   - Raise coverage target (Done — thresholds bumped slightly)
4. Phase 4 — Action / socket logic (core `executeQuery` paths) (In progress)
   - DELAYED timer (start, reset, abort) (Done)
   - BRIGHTNESS, TEMP, NOTIFICATION parsing, HIDE/SHOW/TOGGLE selection logic (Pending)
5. Phase 5 — Persistence & backups (Not started)
   - `answerPost` (saving config), backup rotation, UNDO_CONFIG, failure scenarios (fs errors, disk edge cases)
6. Phase 6 — Module install & update flows (Not started)
   - `installModule`, `updateModule` with mocked `simple-git` & `exec`
7. Phase 7 — System / hardware related commands (Not started)
   - Monitor control (status detection), shutdown/reboot, PM2 control (pm2 mock)
8. Phase 8 — Frontend / DOM logic (jsdom) (Not started)
   - `getDom()` URL/port logic, brightness filter application, temp overlay color gradients
9. Phase 9 — API / contract tests (Not started)
   - Validate against `docs/swagger.json` (add missing if needed)
10. Phase 10 — Optional E2E / Docker integration (Not started)
    - Spin minimal MagicMirror instance; smoke test key endpoints
11. Phase 11 — Raise thresholds & mutation tests (Ongoing)
    - Gradually raise coverage thresholds; consider mutation testing after core paths stable.
