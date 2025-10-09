# Tests

This project uses Node's built-in test runner and c8 for coverage.

Quick run:

- Lint & format check: `node --run lint`
- Spell checking: `node --run test:spelling`
- Unit tests: `node --run test:unit`
- Coverage: `node --run test:coverage`
- Watch mode (local dev): `node --run test:watch`

Guidelines:

- Keep tests side-effect free; mock/bypass filesystem, network, and timers where necessary.
- Focus on **critical logic with edge cases** (e.g., JSON parsing, backup rotation, class management).
- Avoid testing trivial mappings or 1-line forwarding logic.
- For API helpers in `API/api.js`, bind functions to a fake context rather than spinning an Express server.
- For `node_helper.js` paths, test logic by stubbing methods (e.g., `sendSocketNotification`, `sendResponse`) and, when necessary, mock timers.
- Follow repository lint rules; keep arrays/objects on one line where stylistic rules require it.

Notes on shims used in tests:

- We provide lightweight shims under `tests/shims/` (e.g., `logger.js`, `node_helper.js`) to isolate unit tests from MagicMirror core. When a test needs to load `node_helper.js`, inject the shim path via `NODE_PATH` and call `module._initPaths()` before requiring the target file.

Status checkpoint (Updated 2025-10-09):

- **Phases 1–2:** Done (lint/format/spellcheck, utils tests).
- **Phase 3:** Router-level GET coverage removed as low value; no router mapping tests remain.
- **Phase 4:** Core `executeQuery` coverage trimmed to critical paths (NOTIFICATION parsing, MANAGE_CLASSES, DELAYED timers).
- **Next:** Phase 5 (config backup rotation), then Phase 6 (minimal contract checks); roadmap complete afterwards.

## Test Roadmap (Phases) — Slimmed Down

The project follows a **lean, pragmatic** test roadmap. We focus on **critical logic** and **data integrity**, avoiding overkill for trivial forwarding or rarely-used flows.

### Phase 1 — Base quality gates ✅ Done

- Lint, formatter (`prettier`/`eslint`), spellcheck (`cspell`) configured and passing.
- CI/Badges added to README.

### Phase 2 — Test runner & pure utilities ✅ Done

- Node's built-in test runner configured.
- Unit tests for pure functions: `utils` (`capitalizeFirst`, `formatName`, `includes`) and `configUtils` (`cleanConfig` with edge cases: nulls, unknown modules, deep equality).
- Coverage baseline established (c8 thresholds: statements 5%, lines 5%, functions 4%, branches 5%).

### Phase 3 — Router GET coverage ✅ Done (leaned out)

- Initial router-level GET mapping tests were added but later removed (October 2025) after deciding they added little value beyond manual verification.
- ✅ No router mapping tests remain; focus is on higher-value logic.

### Phase 4 — Core action logic (critical paths only) ✅ Done

- ✅ NOTIFICATION JSON parsing (undefined payload, valid JSON string, raw string, invalid JSON → error).
- ✅ MANAGE_CLASSES (string key, array of keys → correct HIDE/SHOW/TOGGLE dispatch).
- ✅ DELAYED timer behavior (start, reset on same `did`, abort).
- ❌ Removed: HIDE/SHOW/TOGGLE, BRIGHTNESS/TEMP, SHOW_ALERT/HIDE_ALERT/REFRESH, USER_PRESENCE (all trivial forwarding).

### Phase 5 — Persistence & backup rotation (Next priority)

- **Goal:** Ensure config save/restore doesn't lose user data.
- **Scope:**
  - `answerPost` → `saveConfig`: backup slot rotation (keep last N), handle fs errors gracefully.
  - `UNDO_CONFIG`: restore from backup, boundary cases (no backups, corrupted JSON).
  - Edge cases: disk full, permission errors, concurrent writes (if applicable).
- **Implementation:** Mock `fs.promises` (readFile, writeFile, readdir, unlink); assert backup count/order.
- **Coverage target after Phase 5:** ~30–35% statements (modest increase from critical paths).

### Phase 6 — Minimal contract checks (final polish)

- **Goal:** Catch breaking API changes early.
- **Scope:** Validate **shape only** (not content) for 2–3 core GET endpoints against `docs/swagger.json`:
  - `/module/installed` → array of objects with `name`/`longname`.
  - `/config` → object (exact keys not critical, just structure).
  - Optional: `/translations` → object with locale keys.
- **Implementation:** Lightweight JSON schema check or manual shape assertion; no heavy validator lib.
- **Coverage impact:** Minimal (contract tests don't add statement coverage, just regression safety).

### Phase 7+ — Done ✅

- **No further phases planned.**
- Install/update flows, system commands, frontend DOM, E2E → **out of scope** (too complex, low ROI for a MagicMirror module).
- Mutation testing → **deferred indefinitely** (overkill for this project size).

---

## Cleanup summary (2025-10-09)

- Removed router-level GET tests (`tests/unit/api.getRoutes.mapping.test.js`).
- Trimmed `executeQuery.core.test.js` to only NOTIFICATION / MANAGE_CLASSES / DELAYED coverage.
- Lowered c8 coverage thresholds to a realistic baseline (statements 5%, lines 5%, functions 4%, branches 5%).

---

## Coverage Philosophy

- **Target:** ~30–35% statements after Phase 5 (backup rotation).
- **Not a goal:** High coverage for its own sake. Focus on **critical paths** and **data integrity**.
- **Strategy:** Raise thresholds modestly after each phase (if tests are stable), but keep them **achievable and meaningful**.

---

## Contributing Tests

When adding tests:

- **Ask:** Does this logic have edge cases or side effects? If no → skip the test.
- **Patterns:**
  - Router handlers: Bind to fake context; avoid spinning up Express.
  - Timers: Use fake timers (manual or `node:test` mocks when available); restore originals after.
  - Filesystem: Mock `fs.promises` methods; no actual reads/writes.
- **Keep PRs small:** 1–2 test files per PR; clear titles (e.g., "test(backup): add rotation and undo cases").

---

## CI & Coverage

[![Build](https://img.shields.io/github/actions/workflow/status/KristjanESPERANTO/MMM-Remote-Control/automated-tests.yaml?branch=master)](../../actions)
[![Coverage](https://img.shields.io/badge/coverage-tests%2FREADME-blue)](./README.md)

For faster iteration:

- Watch mode: `node --run test:watch`
