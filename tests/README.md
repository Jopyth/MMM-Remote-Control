# Tests

This document describes the state of the automated test suite for **MMM-Remote-Control** and the principles that guide it.

## Test stack at a glance

- **Runner:** Node’s built-in test runner (`node --test`).
- **Coverage:** `c8` with low but enforced thresholds (5% statements/lines, 4% functions, 5% branches) to guard critical paths without chasing high numbers.
- **Quality gates:** Lint (`node --run lint`) and spell check (`node --run test:spelling`) are part of the standard `node -- test` pipeline.
- **Execution shortcuts:**
  - Unit tests: `node --run test:unit`
  - Coverage report: `node --run test:coverage`
  - Watch mode: `node --run test:watch`

## What we cover today

- **Configuration persistence (`tests/unit/answerPost.config.test.js`):** verifies backup rotation, graceful aborts when slots are missing, write-error propagation, and the `UNDO_CONFIG` restore flow (match, missing timestamp, load error).
- **API contract checks (`tests/unit/answerGet.contract.test.js`):** asserts response shapes for `/api/module/installed`, `/api/config`, and `/api/translations` without wiring an Express server.
- **Module menu helpers (`tests/unit/api.answerModuleApi.test.js`):** ensures default-config lookups and bulk SHOW actions call into the helper stack correctly.
- **Delayed execution helpers (`tests/unit/delayedFlow.test.js`, `tests/unit/node_helper.delayedQuery.test.js`):** validate the `/delay` wrapper, timer scheduling, reset, and abort semantics.
- **Notification helpers (`tests/unit/executeQuery.core.test.js`, `tests/unit/api.answerNotifyApi.test.js`):** cover JSON payload parsing, MANAGE_CLASSES routing, and composed payload delivery.
- **Pure utilities (`tests/unit/utils.test.js`, `tests/unit/configUtils.test.js`):** keep string-format helpers and `cleanConfig` regressions from sneaking in.

Together these suites focus on code that mutates state, touches the filesystem, or transforms user input—areas where regressions have the highest blast radius.

## What we deliberately skip (and why)

- **Router-to-handler wiring:** Express route-mapping tests were dropped because they duplicated framework behavior and were brittle whenever routes were reordered. Manual smoke tests or integration tests are a better fit.
- **System commands and hardware control (`shutdown`, `reboot`, monitor control):** they depend on Raspberry Pi hardware privileges and side effects we can’t safely stub in CI.
- **Front-end DOM or E2E coverage:** Rendering happens in the MagicMirror browser context; replicating it would require Puppeteer/Electron harnesses that are heavy relative to the payoff.
- **“Pass-through” notification wrappers:** Flows that simply forward parameters (`HIDE_ALERT`, `SHOW_ALERT`, etc.) are exercised indirectly by higher-level tests; duplicating them would be noise.
- **Git/network dependent paths:** Update and install code paths require repositories and network access. We guard their public contract via `getExternalApiByGuessing`/menu tests instead.

Documenting these gaps helps us recognize when a change might require a different kind of test (manual check, integration smoke, etc.).

## Fixtures and shims

- Minimal shims live under `tests/shims/` (for `logger` and `node_helper`). Tests that require MagicMirror globals extend the shim via `NODE_PATH` before importing the module under test.
- Filesystem-heavy suites stub `fs` methods directly, ensuring no real disk I/O occurs.
- Helper factories typically clone the module export and override context methods (e.g., `sendResponse`, `callAfterUpdate`) to keep assertions straightforward.

## Potential future enhancements

- Add a focused regression test for `answerPost` when the config read stream errors mid-pipe (currently logged but unasserted).
- Capture a tiny contract test for `/api/saves` to freeze the backup timestamp ordering behavior.
- Explore lightweight schema validation for `/api/module/available` once module metadata stabilizes—could reuse the existing helper stubs.
- Consider bumping coverage thresholds modestly (for example to 10%) once the above additions land and prove stable.

These ideas stay deliberately small; larger endeavors (integration or E2E) are still considered out of scope unless requirements change.

## Contribution guidelines

- Prefer deterministic unit tests with explicit stubbing over fragile integration harnesses.
- Question every prospective test: if it simply mirrors production code without behavior, it’s likely not worth adding.
- Keep pull requests focused—group related assertions in the same suite and avoid cross-cutting rewrites.
- Restore any global/mocked state (`Module._load`, timers, `fs`) in `afterEach` blocks to keep suites isolated.

Maintaining this lean, purpose-built suite gives fast feedback on the project’s riskiest logic without overwhelming contributors with maintenance burden.
