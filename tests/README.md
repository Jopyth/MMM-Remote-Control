# Tests

This document describes the state of the automated test suite for **MMM-Remote-Control** and the principles that guide it.

## Test stack at a glance

- **Runner:** Node's built-in test runner (`node --test`) – lean, zero-config, future-proof.
- **Coverage:** `c8` with enforced thresholds (30% statements/lines, 20% functions, 60% branches).
- **Quality gates:** Lint (`node --run lint`) and spell check (`node --run test:spelling`) are part of the standard `node --run test` pipeline.
- **Execution shortcuts:**
  - All tests: `node --run test` (includes unit + integration + DOM)
  - Unit tests only: `node --run test:unit`
  - HTTP-layer tests only: `node --run test:integration`
  - DOM tests only: `node --run test:dom`
  - Coverage report: `node --run test:coverage`
  - Watch mode: `node --run test:watch`

## Test structure

```plaintext
tests/
├── unit/           # Isolated logic tests with mocked dependencies
├── integration/    # HTTP-layer tests with real Express routing
├── dom/            # DOM logic tests using happy-dom (no browser required)
└── shims/          # Minimal stubs for MagicMirror globals
```

**Unit tests** verify individual functions in isolation. Fast, deterministic, no I/O.

**Integration tests** start a real Express server and make HTTP requests. They catch:

- Route wiring bugs (wrong paths, missing endpoints)
- Middleware ordering issues
- JSON parsing/serialization problems
- Authentication/error response formats

**DOM tests** verify frontend logic (`remote.js`) in a simulated DOM environment using happy-dom. Fast, CI-friendly, no browser required.

All tests run in CI/CD without MagicMirror runtime or browser dependencies.

## What we cover today

### Unit tests (`tests/unit/`)

| Suite                                             | Purpose                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `answerPost.config.test.js`                       | Config persistence: backup rotation, write-error propagation, `UNDO_CONFIG` restore flow |
| `answerGet.contract.test.js`                      | Response shapes, data assembly logic, and schema validation for module/config endpoints  |
| `answerGet.saves.test.js`                         | Backup timestamp ordering and ENOENT handling for `/api/saves`                           |
| `api.answerModuleApi.test.js`                     | Module API edge cases and action routing                                                 |
| `api.mergeData.test.js`                           | Config merging with external API routes                                                  |
| `api.delayedFlow.test.js`, `delayedQuery.test.js` | `/delay` wrapper, timer scheduling, reset, abort semantics                               |
| `executeQuery.core.test.js`                       | Module visibility, notifications, system actions (SHOW/HIDE/REFRESH/RESTART)             |
| `executeQuery.error.test.js`                      | Error handling for malformed JSON, missing params                                        |
| `api.helpers.test.js`                             | JSON payload parsing, delay parameter handling                                           |
| `executeQuery.alerts.test.js`                     | Alert handling (SHOW_ALERT/HIDE_ALERT parameter handling)                                |
| `executeQuery.notifications.test.js`              | Notification wrapper functions and routing logic                                         |
| `executeQuery.handlers.test.js`                   | Action handlers, delayed queries, callback scheduling                                    |
| `helper.config.test.js`                           | Config path resolution, module directory handling                                        |
| `helper.utils.test.js`                            | Response handling, translation, error checking, network utilities                        |
| `answerGetChangelog.test.js`                      | Changelog file retrieval and error handling                                              |
| `socketNotification.test.js`                      | Socket notification routing (CURRENT_STATUS, REQUEST_DEFAULT_SETTINGS, REMOTE_ACTION)    |
| `helper.getConfig.test.js`                        | Config merging with defaults from moduleData                                             |
| `utils.test.js`, `configUtils.test.js`            | String-format helpers and `cleanConfig` regressions                                      |

### DOM tests (`tests/dom/`)

| Suite                        | Purpose                                                              |
| ---------------------------- | -------------------------------------------------------------------- |
| `remote.smoke.test.js`       | Frontend logic tests using happy-dom (no browser required)           |
| `MMM-Remote-Control.test.js` | Module initialization and lockStrings handling with edge case checks |

### HTTP-layer tests (`tests/integration/`)

| Suite               | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `api.smoke.test.js` | HTTP-layer smoke tests for Express routing and API contracts |

Together these suites focus on isolated logic (unit tests) and HTTP contract verification (HTTP-layer tests)—the most critical areas for catching regressions while remaining CI-friendly.

## Current coverage reality

As of December 2024, actual coverage stands at:

| Metric           | Value | Threshold | Notes                                      |
| ---------------- | ----- | --------- | ------------------------------------------ |
| Statements       | ~49%  | 30%       | Reached plateau with core logic covered    |
| Branches         | ~83%  | 60%       | Strong branch coverage                     |
| Functions        | ~57%  | 20%       | Major handlers and utilities tested        |
| Lines            | ~49%  | 30%       | Mirrors statement coverage                 |
| `node_helper.js` | ~28%  | -         | Core actions and notification flow covered |
| `API/api.js`     | ~62%  | -         | Edge cases and routing verified            |

Thresholds now provide meaningful regression protection while remaining achievable. Further gains would require testing system commands and hardware integration better suited for E2E or manual testing.

## What we deliberately skip (and why)

- **Router-to-handler wiring:** Express route-mapping tests duplicated framework behavior and broke on route reordering. Manual smoke tests or integration tests are better.
- **System commands and hardware control (`shutdown`, `reboot`, monitor control):** Depend on Raspberry Pi hardware privileges and side effects we can't safely stub in CI.
- **E2E browser tests:** Full Puppeteer/Playwright tests with real browsers are heavy and flaky. We test frontend logic with happy-dom instead (fast, deterministic, CI-friendly).
- **"Pass-through" notification wrappers:** Flows that simply forward parameters (`HIDE_ALERT`, `SHOW_ALERT`, etc.) are exercised indirectly; duplicating them would be noise.
- **Git/network dependent paths:** Update and install code paths require repositories and network access. We guard their public contract via `getExternalApiByGuessing`/menu tests instead.

Documenting these gaps helps us recognize when a change might require a different kind of test (manual check, integration smoke, etc.).

## Fixtures and shims

- Minimal shims live under `tests/shims/` (for `logger` and `node_helper`). Tests extend the shim via `NODE_PATH` before importing the module under test.
- **Unit tests:** Stub `fs` methods directly, ensuring no real disk I/O. Use helper factories to clone module exports and override context methods (e.g., `sendResponse`, `callAfterUpdate`).
- **HTTP-layer tests:** Mock MagicMirror globals (`Module`, `Log`) but use real Express routing and HTTP layer. Capture socket notifications instead of sending them. Bind real API/helper methods to mock context. Focus is on API contracts and Express wiring, not end-to-end MagicMirror integration.

---

## HTTP-layer test approach

The HTTP-layer smoke test (`tests/integration/api.smoke.test.js`) tests Express routing and API contracts without requiring full MagicMirror runtime:

**What's real:**

- Express app and router
- HTTP requests/responses (using `fetch`)
- Middleware execution (JSON parsing, authentication)
- Route matching and parameter extraction

**What's mocked:**

- MagicMirror globals (`Module`, `Log`)
- Socket notifications (captured in array, not sent)
- File system operations
- Module-specific logic requiring runtime

**What this tests (and doesn't):**

✅ **Does catch:**

- Route wiring bugs (wrong paths, missing routes)
- Middleware issues (wrong order, missing JSON parser)
- Response format changes (breaking API contracts)
- HTTP-level errors (400/403/500 responses)
- Content-Type validation

❌ **Does NOT catch:**

- MagicMirror module interaction bugs
- Socket notification delivery to frontend
- Config file parsing from disk
- Module lifecycle (show/hide actual modules)
- External module API discovery

**Trade-off rationale:**

These are **HTTP-layer tests**, not end-to-end integration tests. They verify Express routing and API contracts without MagicMirror runtime. They sit between pure unit tests (which don't test HTTP at all) and full E2E tests (which require Electron/browser and can't run in CI). They're valuable for catching route wiring bugs, middleware issues, and API contract breakage, but don't replace manual testing with actual MagicMirror.

**Key learnings:**

1. **Shims are essential:** Reuse `tests/shims/` setup to resolve MagicMirror dependencies
2. **Method binding matters:** API methods call `this.answerGet()` etc. – bind them to mock context with `.bind(mockContext)`
3. **Minimal stubs suffice:** Only stub methods actually called during test execution (`getExternalApiByGuessing`, `updateModuleApiMenu`)
4. **Random ports work:** Use `server.listen(0)` to get a free port, avoiding conflicts
5. **CI-compatible:** No browser/Electron/hardware dependencies – runs in any Node.js environment

This approach catches route wiring bugs, middleware issues, and response format problems that unit tests miss, while remaining fast and deterministic.

---

## Out of scope

- Full E2E tests with Puppeteer/Playwright
- Hardware-dependent command testing (shutdown, reboot, monitor control)
- Git/network-dependent install/update flows

## Coverage status and philosophy

As of December 2025, coverage has reached a healthy plateau through **incremental, high-value testing**:

- **~49% statements** – Core logic paths covered
- **~57% functions** – Major handlers tested
- **~83% branches** – Strong conditional coverage
- **152 tests** – Mix of unit, integration, and DOM tests

### Why we stop here

Further coverage gains would hit **diminishing returns**:

- Remaining untested code is primarily **system commands** (`shutdown`, `reboot`, monitor control) requiring hardware/privileges
- **Complex integration points** (PM2, Electron, git operations) need E2E tests, not unit tests
- **Express routing details** already verified at HTTP layer
- Mock complexity would exceed test value

### Testing principles (when adding new tests)

- **Test behavior, not coverage** – Every test should catch real bugs or prevent regressions
- **Minimal mocking** – If a test needs >5 mocks, reconsider the abstraction
- **Skip brittle integration points** – File system, network, hardware, DOM manipulation better suited for E2E
- **Avoid duplication** – Don't re-test what HTTP-layer tests already cover
- **Edge cases only** – For utilities (`lib/configUtils.js`, `lib/utils.js`), add tests when behavior changes

---

## Contribution guidelines

- Prefer deterministic unit tests with explicit stubbing over fragile integration harnesses.
- Question every prospective test: if it simply mirrors production code without asserting behavior, it's likely not worth adding.
- Keep pull requests focused—group related assertions in the same suite and avoid cross-cutting rewrites.
- Restore any global/mocked state (`Module._load`, timers, `fs`) in `afterEach` blocks to keep suites isolated.
- Use `describe`/`test` from `node:test` directly – no aliases or compatibility shims.

Maintaining this lean, purpose-built suite gives fast feedback on the project's riskiest logic without overwhelming contributors with maintenance burden.
