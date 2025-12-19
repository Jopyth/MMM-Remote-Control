# Tests

This document describes the state of the automated test suite for **MMM-Remote-Control** and the principles that guide it.

## Test stack at a glance

- **Runner:** Node's built-in test runner (`node --test`) – lean, zero-config, future-proof.
- **Coverage:** `c8` with enforced thresholds (currently 5% statements/lines, 4% functions, 5% branches).
- **Quality gates:** Lint (`node --run lint`) and spell check (`node --run test:spelling`) are part of the standard `node --run test` pipeline.
- **Execution shortcuts:**
  - Unit tests: `node --run test:unit`
  - Coverage report: `node --run test:coverage`
  - Watch mode: `node --run test:watch`

## What we cover today

| Suite                                              | Purpose                                                                                  |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `answerPost.config.test.js`                        | Config persistence: backup rotation, write-error propagation, `UNDO_CONFIG` restore flow |
| `answerGet.contract.test.js`                       | Response shapes for `/api/module/installed`, `/api/config`, `/api/translations`          |
| `api.answerModuleApi.test.js`                      | Default-config lookups and bulk SHOW actions                                             |
| `api.delayedFlow.test.js`, `delayedQuery.test.js`  | `/delay` wrapper, timer scheduling, reset, abort semantics                               |
| `executeQuery.core.test.js`, `api.helpers.test.js` | JSON payload parsing, `MANAGE_CLASSES` routing, notification composition                 |
| `utils.test.js`, `configUtils.test.js`             | String-format helpers and `cleanConfig` regressions                                      |

Together these suites focus on code that mutates state, touches the filesystem, or transforms user input—areas where regressions have the highest blast radius.

## Current coverage reality

As of December 2024, actual coverage stands at:

| Metric           | Value | Notes                                |
| ---------------- | ----- | ------------------------------------ |
| Statements       | ~26%  | Threshold is 5% – very low guard     |
| Functions        | ~17%  | Many `executeQuery` actions untested |
| `node_helper.js` | ~10%  | Core module, highest risk            |
| `API/api.js`     | ~57%  | Reasonably covered                   |

The thresholds prevent obvious regressions but don't yet guard the module's core logic adequately.

## What we deliberately skip (and why)

- **Router-to-handler wiring:** Express route-mapping tests duplicated framework behavior and broke on route reordering. Manual smoke tests or integration tests are better.
- **System commands and hardware control (`shutdown`, `reboot`, monitor control):** Depend on Raspberry Pi hardware privileges and side effects we can't safely stub in CI.
- **Front-end DOM or E2E coverage:** Rendering happens in MagicMirror's browser context; Puppeteer/Electron harnesses are heavy relative to payoff.
- **"Pass-through" notification wrappers:** Flows that simply forward parameters (`HIDE_ALERT`, `SHOW_ALERT`, etc.) are exercised indirectly; duplicating them would be noise.
- **Git/network dependent paths:** Update and install code paths require repositories and network access. We guard their public contract via `getExternalApiByGuessing`/menu tests instead.

Documenting these gaps helps us recognize when a change might require a different kind of test (manual check, integration smoke, etc.).

## Fixtures and shims

- Minimal shims live under `tests/shims/` (for `logger` and `node_helper`). Tests extend the shim via `NODE_PATH` before importing the module under test.
- Filesystem-heavy suites stub `fs` methods directly, ensuring no real disk I/O occurs.
- Helper factories clone the module export and override context methods (e.g., `sendResponse`, `callAfterUpdate`) to keep assertions straightforward.

---

## TODO: Test improvements roadmap

### Short-term (coverage gaps)

- [ ] **Add negative/error-path tests** – Happy paths are covered, but we lack:
  - Malformed JSON body handling in POST requests
  - Missing required params (e.g., `notification` in `/api/notification`)
  - Config read-stream errors mid-pipe (mentioned in old "future enhancements")

### Medium-term (structural improvements)

- [ ] **Raise coverage thresholds to 15-20%** – Once the above items land, bump thresholds in `package.json` `c8` config to actually guard the new coverage.

- [ ] **Add one integration smoke test** – A minimal test that:
  1. Starts the Express app
  2. Sends one GET and one POST request
  3. Asserts success responses

  This catches wiring bugs without full E2E complexity. Could use `node:http` directly.

- [ ] **Contract test for `/api/saves`** – Freeze the backup timestamp ordering behavior to catch regressions.

- [ ] **Schema validation for `/api/module/available`** – Once module metadata stabilizes, validate field presence/types systematically.

### Out of scope (unless requirements change)

- Full E2E tests with Puppeteer/Playwright
- Hardware-dependent command testing (shutdown, reboot, monitor control)
- Git/network-dependent install/update flows

---

## Contribution guidelines

- Prefer deterministic unit tests with explicit stubbing over fragile integration harnesses.
- Question every prospective test: if it simply mirrors production code without asserting behavior, it's likely not worth adding.
- Keep pull requests focused—group related assertions in the same suite and avoid cross-cutting rewrites.
- Restore any global/mocked state (`Module._load`, timers, `fs`) in `afterEach` blocks to keep suites isolated.
- Use `describe`/`test` from `node:test` directly – no aliases or compatibility shims.

Maintaining this lean, purpose-built suite gives fast feedback on the project's riskiest logic without overwhelming contributors with maintenance burden.
