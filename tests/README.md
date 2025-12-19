# Tests

This document describes the state of the automated test suite for **MMM-Remote-Control** and the principles that guide it.

## Test stack at a glance

- **Runner:** Node's built-in test runner (`node --test`) – lean, zero-config, future-proof.
- **Coverage:** `c8` with enforced thresholds (30% statements/lines, 20% functions, 60% branches).
- **Quality gates:** Lint (`node --run lint`) and spell check (`node --run test:spelling`) are part of the standard `node --run test` pipeline.
- **Execution shortcuts:**
  - All tests: `node --run test` (includes unit + HTTP-layer)
  - Unit tests only: `node --run test:unit`
  - HTTP-layer tests only: `node --run test:integration`
  - Coverage report: `node --run test:coverage`
  - Watch mode: `node --run test:watch`

## Test structure

```plaintext
tests/
├── unit/           # Isolated logic tests with mocked dependencies
├── integration/    # HTTP-layer tests with real Express routing
└── shims/          # Minimal stubs for MagicMirror globals
```

**Unit tests** verify individual functions in isolation. Fast, deterministic, no I/O.

**Integration tests** start a real Express server and make HTTP requests. They catch:

- Route wiring bugs (wrong paths, missing endpoints)
- Middleware ordering issues
- JSON parsing/serialization problems
- Authentication/error response formats

Both run in CI/CD without MagicMirror runtime or browser dependencies.

## What we cover today

### Unit tests (`tests/unit/`)

| Suite                                             | Purpose                                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `answerPost.config.test.js`                       | Config persistence: backup rotation, write-error propagation, `UNDO_CONFIG` restore flow |
| `answerGet.contract.test.js`                      | Response shapes, data assembly logic, and schema validation for module/config endpoints  |
| `answerGet.saves.test.js`                         | Backup timestamp ordering and ENOENT handling for `/api/saves`                           |
| `api.answerModuleApi.test.js`                     | Default-config lookups and bulk SHOW actions                                             |
| `api.delayedFlow.test.js`, `delayedQuery.test.js` | `/delay` wrapper, timer scheduling, reset, abort semantics                               |
| `executeQuery.core.test.js`                       | Module visibility, notifications, system actions (SHOW/HIDE/REFRESH/RESTART)             |
| `executeQuery.error.test.js`                      | Error handling for malformed JSON, missing params                                        |
| `api.helpers.test.js`                             | JSON payload parsing, delay parameter handling                                           |
| `utils.test.js`, `configUtils.test.js`            | String-format helpers and `cleanConfig` regressions                                      |

### HTTP-layer tests (`tests/integration/`)

| Suite               | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `api.smoke.test.js` | HTTP-layer smoke tests for Express routing and API contracts |

Together these suites focus on isolated logic (unit tests) and HTTP contract verification (HTTP-layer tests)—the most critical areas for catching regressions while remaining CI-friendly.

## Current coverage reality

As of December 2024, actual coverage stands at:

| Metric           | Value | Threshold | Notes                                   |
| ---------------- | ----- | --------- | --------------------------------------- |
| Statements       | ~42%  | 30%       | Improved from ~26% with Priority 1+2    |
| Branches         | ~78%  | 60%       | Strong branch coverage                  |
| Functions        | ~38%  | 20%       | Improved from ~17% with edge case tests |
| Lines            | ~42%  | 30%       | Mirrors statement coverage              |
| `node_helper.js` | ~15%  | -         | Improved with state/value action tests  |
| `API/api.js`     | ~62%  | -         | Edge cases covered                      |

Thresholds now provide meaningful regression protection while remaining achievable.

## What we deliberately skip (and why)

- **Router-to-handler wiring:** Express route-mapping tests duplicated framework behavior and broke on route reordering. Manual smoke tests or integration tests are better.
- **System commands and hardware control (`shutdown`, `reboot`, monitor control):** Depend on Raspberry Pi hardware privileges and side effects we can't safely stub in CI.
- **Front-end DOM or E2E coverage:** Rendering happens in MagicMirror's browser context; Puppeteer/Electron harnesses are heavy relative to payoff.
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

## Coverage improvement strategy

To reach 50%+ coverage efficiently, focus on **high-impact, low-mock areas**:

### Priority 2: `API/api.js` remaining gaps (currently ~58%)

- **Error response paths** – Already covered in HTTP-layer tests, but add unit tests for specific error constructors
- **mergeData** logic – Config merging with external API routes

### Priority 3: Helper utilities (currently well-covered)

- Additional edge cases in `lib/configUtils.js` and `lib/utils.js` only if behavior changes

### What NOT to chase:

- **Don't test for coverage percentage alone** – Every test should catch real bugs or prevent regressions
- **Avoid mocking complexity** – If a test needs >5 mocks, it's testing the wrong thing
- **Skip brittle integration points** – File system, network, hardware, DOM manipulation
- **Don't duplicate HTTP-layer tests** – Already covered at the right abstraction level

### Incremental approach:

1. Pick **one** untested action from Priority 1
2. Write test with **minimal setup** (reuse existing helper factories)
3. Verify it catches a real regression (e.g., bounds checking, null handling)
4. Repeat until diminishing returns

Target: **50% statements** is realistic and valuable. Beyond that, focus shifts to integration/manual testing.

---

## Contribution guidelines

- Prefer deterministic unit tests with explicit stubbing over fragile integration harnesses.
- Question every prospective test: if it simply mirrors production code without asserting behavior, it's likely not worth adding.
- Keep pull requests focused—group related assertions in the same suite and avoid cross-cutting rewrites.
- Restore any global/mocked state (`Module._load`, timers, `fs`) in `afterEach` blocks to keep suites isolated.
- Use `describe`/`test` from `node:test` directly – no aliases or compatibility shims.

Maintaining this lean, purpose-built suite gives fast feedback on the project's riskiest logic without overwhelming contributors with maintenance burden.
