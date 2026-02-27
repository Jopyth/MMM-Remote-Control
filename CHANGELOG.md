# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [4.8.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.7.0...v4.8.0) (2026-02-27)

### Fixed

- add timeout and supersede handling to loadList via AbortSignal ([2edc9c0](https://github.com/jopyth/MMM-Remote-Control/commit/2edc9c0097b93ea42d248f225e62f2ae79d79ccf))
- correct lazy-render regressions ([7beeb6c](https://github.com/jopyth/MMM-Remote-Control/commit/7beeb6cd968faa22bc9704a4310921848b50cbdf))
- handle object data in handleLoadList empty indicator ([43f6a5b](https://github.com/jopyth/MMM-Remote-Control/commit/43f6a5b382109eda83db1a55d109d70b293c41f3))
- insert overlays before body instead of after it ([eddebb4](https://github.com/jopyth/MMM-Remote-Control/commit/eddebb4da6c7271f17f23f466f17d120b1723bfc))
- move brightness/temp overlays outside zoomed body ([7157ede](https://github.com/jopyth/MMM-Remote-Control/commit/7157edefcf6a50510e003a3e068ee907780f141f))
- remove nested scroll containers in edit menu ([0d79bfe](https://github.com/jopyth/MMM-Remote-Control/commit/0d79bfe398e8fad4dce89814163b5cebc99cd2c4))
- reset scroll position and keyboard focus on menu navigation ([d30342c](https://github.com/jopyth/MMM-Remote-Control/commit/d30342cfbfd1024428067bc00754db2f2566d47d))

### Documentation

- fix sendSocketNotification -> sendNotification in DELAYED actions example ([85fcb94](https://github.com/jopyth/MMM-Remote-Control/commit/85fcb946358439215d0adc93e501b9e871a498da))

### Chores

- simplify demo script command ([c2e70f5](https://github.com/jopyth/MMM-Remote-Control/commit/c2e70f527f93f11292531a8f0c70928a6dc79e91))
- update dependencies ([f3d113a](https://github.com/jopyth/MMM-Remote-Control/commit/f3d113a7fe836745f8934cea48e6030b3e263965))

### Code Refactoring

- convert remote scripts to ESM with import map (Schritt 8) ([0ddc7cd](https://github.com/jopyth/MMM-Remote-Control/commit/0ddc7cd7c5bc574c3f354c6bf849130e780ac117))
- CSS cleanup — remove unused rules, merge duplicates ([8e1b8f3](https://github.com/jopyth/MMM-Remote-Control/commit/8e1b8f3a5b82ca85ad93a96a7affb65f52611861))
- CSS nesting — header-title icons, range/checkbox inputs, badge colors ([de01f34](https://github.com/jopyth/MMM-Remote-Control/commit/de01f34312ddaf67bb93b741281e5fe80fffd045))
- deduplicate slider/picker listeners in attachEditMenuListeners ([e6bd86d](https://github.com/jopyth/MMM-Remote-Control/commit/e6bd86d9b2beb2a5618126f608f1849bedc5b69c))
- deduplicate switch cases in remote-socket.mjs ([3c5f0a5](https://github.com/jopyth/MMM-Remote-Control/commit/3c5f0a580c2a58c4261548938643d7fe9cd0036e))
- extract shared DOM test fixture into tests/dom/setup.mjs ([a24d2f6](https://github.com/jopyth/MMM-Remote-Control/commit/a24d2f6c46bc780ad6f2c87f890e395786106f34))
- introduce action()/getData() helpers for REMOTE_ACTION ([31cba19](https://github.com/jopyth/MMM-Remote-Control/commit/31cba190f0cf42de936154b347c7066bb0e57aca))
- make buttons in remote.mjs data-driven ([03d009b](https://github.com/jopyth/MMM-Remote-Control/commit/03d009be8335f8ec9f8e95b3b63d4f07b5b63cf2))
- remove dead code, fix bugs, modernize DOM APIs ([80cacab](https://github.com/jopyth/MMM-Remote-Control/commit/80cacabe85be6ed0a6becfb5906ca045f215126f))
- remove hasClass() wrapper, use classList.contains() directly ([15df598](https://github.com/jopyth/MMM-Remote-Control/commit/15df598f7e714b27e0aed268e6c133d47aac7087))
- render menu HTML dynamically from JS ([7872341](https://github.com/jopyth/MMM-Remote-Control/commit/78723413ade261b6b59da49bd8569dc7a01a9ef4))
- replace 9 hash-nav button handlers with data-hash delegation ([fbd39a7](https://github.com/jopyth/MMM-Remote-Control/commit/fbd39a738d6ddb6ef1de40095ed3b18850a47e0c))
- replace createElement chains with template literals in remote.js ([9ff33cb](https://github.com/jopyth/MMM-Remote-Control/commit/9ff33cbbe6e103dbd0241d834740ff8c4abd247e))
- replace deprecated url.parse with request.query ([4e6b8a8](https://github.com/jopyth/MMM-Remote-Control/commit/4e6b8a8fbab302bc52e39093fd8dd037352d1819))
- replace focus/blur JS listeners with CSS :focus-within ([7ca8399](https://github.com/jopyth/MMM-Remote-Control/commit/7ca839916110c099f49d1b732a0b0cb70520234c))
- replace hard media queries with fluid clamp() scaling ([46e2149](https://github.com/jopyth/MMM-Remote-Control/commit/46e2149b710efdc531c345bf0e726e6a88fe1c8a))
- replace pendingResolver with Map and inline hide/show ([0b78812](https://github.com/jopyth/MMM-Remote-Control/commit/0b78812d037acbaf5d8beab60e60f7d174734ef1))
- simplify callAfterUpdate using closure instead of waitObject ([f02b2e2](https://github.com/jopyth/MMM-Remote-Control/commit/f02b2e2e3c11f35f24fe9b579a6db45699bd3d67))
- simplify code and fix success-popup visibility ([09b1d37](https://github.com/jopyth/MMM-Remote-Control/commit/09b1d37c3b2180c968facc08faa5154ccd5a6846))
- simplify config editor helpers in remote.js ([0405aa1](https://github.com/jopyth/MMM-Remote-Control/commit/0405aa1df80d6bc24ef68f97f870374328864920))
- split remote.js into topic-focused files (Schritt 7) ([86b39be](https://github.com/jopyth/MMM-Remote-Control/commit/86b39be667e048a69fec1f83bb95b810301f8758))
- streamline remote-modules.mjs ([c5f6831](https://github.com/jopyth/MMM-Remote-Control/commit/c5f6831ac1ee410a3f4f37c982142f9cbb2ee11c))

### Tests

- add unit tests for hasForcedType, getTypeAsString, createConfigInput, updateSliderThumbColor ([9e7d4ff](https://github.com/jopyth/MMM-Remote-Control/commit/9e7d4ff61f4a86c8646f6fe3ee054eb5f2025240))

## [4.7.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.6.0...v4.7.0) (2026-02-25)

### Added

- add zoom, background color and font color controls ([93b4b81](https://github.com/jopyth/MMM-Remote-Control/commit/93b4b81b3968015b971da2bc0f1710183a12f211)), closes [#238](https://github.com/jopyth/MMM-Remote-Control/issues/238)

### Fixed

- accept plain strings as notification payload ([b49fbcf](https://github.com/jopyth/MMM-Remote-Control/commit/b49fbcf34c9fd02a7af89c159191270a4594eca6)), closes [#383](https://github.com/jopyth/MMM-Remote-Control/issues/383)
- prevent crash when sending notification without payload ([cafa299](https://github.com/jopyth/MMM-Remote-Control/commit/cafa299c38ee0857a2e886e10f75950783d42edd))
- prevent crashes and duplicate entries in getExternalApiByGuessing ([e351b10](https://github.com/jopyth/MMM-Remote-Control/commit/e351b1064a8ba0339e223645d16002d31ca5ab8b))

### Chores

- disable max-lines-per-function for test files ([bcf80f0](https://github.com/jopyth/MMM-Remote-Control/commit/bcf80f06e830280d329fa406d693ffd752d8a2bb))
- extend cspell words ([291f983](https://github.com/jopyth/MMM-Remote-Control/commit/291f9830c454d12932990d8e1d9f0bfbbc8df737))
- update devDependencies ([38328ab](https://github.com/jopyth/MMM-Remote-Control/commit/38328ab86782282e249861292c88bda1610a3063))

### Tests

- improve coverage for systemControl and moduleManager ([0c4f4c9](https://github.com/jopyth/MMM-Remote-Control/commit/0c4f4c9253b6626c944c74fa3e6eb85177249da2))

### Continuous Integration

- add test coverage check to automated tests workflow ([7c0086a](https://github.com/jopyth/MMM-Remote-Control/commit/7c0086a83833c758eeebeccff4221ddb83ce9faa))

## [4.6.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.5.0...v4.6.0) (2026-02-24)

### Added

- add API URL preview to notification menu ([c067078](https://github.com/jopyth/MMM-Remote-Control/commit/c0670785c73022d65a63f9f57bc3e603d8081c76))

### Chores

- update devDependencies ([3afd74c](https://github.com/jopyth/MMM-Remote-Control/commit/3afd74c9007e67bafb88e01d8b9702bcb818f7e8))

## [4.5.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.4.0...v4.5.0) (2026-02-24)

### Added

- add showNotificationMenu config option ([28f3444](https://github.com/jopyth/MMM-Remote-Control/commit/28f3444fd001791609e4a426a89a3d3fcdd71559))
- set default value for showModuleApiMenu to true ([c1e1a90](https://github.com/jopyth/MMM-Remote-Control/commit/c1e1a907ee50065e478af4bf834e4efd3fa5ff95))

## [4.4.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.3.0...v4.4.0) (2026-02-23)

### Added

- restore localStorage for notification form and fix textarea height ([845d464](https://github.com/jopyth/MMM-Remote-Control/commit/845d464f68ffe48f950c0bfb73e8ee80991c37d5))

### Fixed

- fix getActions empty key and action.payload falsy check in api.js ([536987b](https://github.com/jopyth/MMM-Remote-Control/commit/536987bb8633679f5a4c762250621eaee748ef77))
- pass numeric/boolean payloads through handleNotification ([eed2f1e](https://github.com/jopyth/MMM-Remote-Control/commit/eed2f1e8722fc2fd573642a0bf60a4c435e4cc9b))

### Chores

- add missing translations ([e056791](https://github.com/jopyth/MMM-Remote-Control/commit/e056791ff7ba05894f577f729cda95baf1e53dc1))
- add MMM-pages to demo config ([e68e424](https://github.com/jopyth/MMM-Remote-Control/commit/e68e424213d8a681f85a0b7fde9314d8eeec0d51))
- update dependencies ([aa0bf12](https://github.com/jopyth/MMM-Remote-Control/commit/aa0bf128fd7cdea221011e224238df3ef7edfac2))

## [4.3.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.2.4...v4.3.0) (2026-02-22)

### Added

- add notification sender to remote.html ([c364c55](https://github.com/jopyth/MMM-Remote-Control/commit/c364c55e164f53afc1a1db6f7b1dac12619098f3)), closes [#383](https://github.com/jopyth/MMM-Remote-Control/issues/383)

## [4.2.4](https://github.com/jopyth/MMM-Remote-Control/compare/v4.2.3...v4.2.4) (2026-02-21)

### Fixed

- improve error message when API key is missing ([88214e4](https://github.com/jopyth/MMM-Remote-Control/commit/88214e4b69658d44e241f5192909143f6ad4f8d5))
- skip app.relaunch() when running under pm2 to prevent EADDRINUSE loop ([e021bc2](https://github.com/jopyth/MMM-Remote-Control/commit/e021bc22314dc6e79b27f6b7d32f1dae7410e9bb))

## [4.2.3](https://github.com/jopyth/MMM-Remote-Control/compare/v4.2.2...v4.2.3) (2026-02-21)

### Chores

- add "someaction" to cspell configuration ([b854832](https://github.com/jopyth/MMM-Remote-Control/commit/b854832ef44ed74b2e5af6723ab3aba9b9b2d958))
- change variable declaration from let to const ([03626c5](https://github.com/jopyth/MMM-Remote-Control/commit/03626c5cd2398cb4ffa0c17adfc6db5f59e129f7))
- refine automated tests workflow by specifying unit, integration, and DOM tests ([414f10a](https://github.com/jopyth/MMM-Remote-Control/commit/414f10a6a4ad6323adf6bb406e8fcc1c8ec86fd9))
- update dependencies ([2093e9a](https://github.com/jopyth/MMM-Remote-Control/commit/2093e9aaa4ead2791b83934e189565c142b66c02))

### Tests

- expand unit coverage for core modules ([b36b36b](https://github.com/jopyth/MMM-Remote-Control/commit/b36b36bee2858079f627cd60bd20e01e384e760f))
- update test script to streamline test execution ([648d6be](https://github.com/jopyth/MMM-Remote-Control/commit/648d6be5d1961a9c4e609bf9a806bb80557123b2))

## [4.2.2](https://github.com/jopyth/MMM-Remote-Control/compare/v4.2.1...v4.2.2) (2026-02-07)

### Fixed

- handle undefined module actions with fallback for alert module ([b30be3e](https://github.com/jopyth/MMM-Remote-Control/commit/b30be3ea32b545f3d10d4cc4b63d00aaf7ba1716))

### Chores

- simplify ESLint config and handle linter issues ([056801d](https://github.com/jopyth/MMM-Remote-Control/commit/056801dd6fa187565a0c5f4a68b1d0aa0db0a8fc))

## [4.2.1](https://github.com/jopyth/MMM-Remote-Control/compare/v4.2.0...v4.2.1) (2026-02-06)

### Fixed

- handle undefined module actions in API endpoints ([5a41e4b](https://github.com/jopyth/MMM-Remote-Control/commit/5a41e4b79f7d754f5d8193060998acd6108502db))

### Chores

- update devDependencies ([9437bf3](https://github.com/jopyth/MMM-Remote-Control/commit/9437bf32d7172ba7f83eb74d10d41228abfabc14))

## [4.2.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.5...v4.2.0) (2026-01-28)

### Added

- support new default modules path for MM >= 2.35.0 ([5109efa](https://github.com/jopyth/MMM-Remote-Control/commit/5109efa8b84a30538e18b202fcab68c43a4253d3)), closes [#377](https://github.com/jopyth/MMM-Remote-Control/issues/377)

### Fixed

- change runner from ubuntu-latest to ubuntu-slim in workflows ([58369cd](https://github.com/jopyth/MMM-Remote-Control/commit/58369cd71d489e67788f37d43f62aab98c94b939))
- initialize API routes before modules load to prevent 404 errors ([3f9309a](https://github.com/jopyth/MMM-Remote-Control/commit/3f9309a4f4b176152b4cd6d1b217a69c4035b78d))
- mock electron module for CI environment in systemControl tests ([5b0850d](https://github.com/jopyth/MMM-Remote-Control/commit/5b0850d79ed173a318d45d35f79ed99ae5e4a4c6))

### Chores

- update devDependencies ([fd6c37d](https://github.com/jopyth/MMM-Remote-Control/commit/fd6c37d583f106f92b7f0068bfd6b7b128fab831))
- update modules.json.template ([765de75](https://github.com/jopyth/MMM-Remote-Control/commit/765de75198810c5833d1d332baf347d1458aac0f))

### Code Refactoring

- handle linter issues after eslint plugin update ([f2f2f8d](https://github.com/jopyth/MMM-Remote-Control/commit/f2f2f8d5628e0724f023d6ad7fa2ca8919e0098b))

## [4.1.5](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.4...v4.1.5) (2026-01-06)

### Fixed

- use exact match for specific module instances in API ([1c26553](https://github.com/jopyth/MMM-Remote-Control/commit/1c2655345c6b649cdcd9149d6cd8c5315c77a843))

### Chores

- add "postchangelog" to cspell configuration ([77b53a5](https://github.com/jopyth/MMM-Remote-Control/commit/77b53a5924e5872fba1e45c26351cca02b066df5))

### Code Refactoring

- extract systemControl to lib/systemControl.js ([d114eea](https://github.com/jopyth/MMM-Remote-Control/commit/d114eeae872857bcb980a047f117ace29ab92a87))

## [4.1.4](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.3...v4.1.4) (2026-01-06)

### Fixed

- prevent duplicate HTTP responses for multi-instance modules ([aae4801](https://github.com/jopyth/MMM-Remote-Control/commit/aae4801efdbc15925d45a256dd3d1825c53d1e25))

### Chores

- switch changelog config format ([ba3c058](https://github.com/jopyth/MMM-Remote-Control/commit/ba3c0583c7d7cf86e873bf2e86cca678c0ae86ba))

### Code Refactoring

- extract module manager to lib/moduleManager.js ([bf7d660](https://github.com/jopyth/MMM-Remote-Control/commit/bf7d6607d28d522ee166d3863ad0520004460b8e))

### Tests

- add suppressExpectedErrors functionality to logger for cleaner test output ([ca7b536](https://github.com/jopyth/MMM-Remote-Control/commit/ca7b53692ac20dacd0e3a4c80fca1217e596712b))

## [4.1.3](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.2...v4.1.3) (2026-01-04)

### Bug Fixes

- **ci:** handle missing defaults.js in test environments ([494f037](https://github.com/jopyth/MMM-Remote-Control/commit/494f03731a3d7e12add790a44eddd0bce123b37b))

### Code Refactoring

- remove formatName utility and update related references ([642e0fa](https://github.com/jopyth/MMM-Remote-Control/commit/642e0fa9c723515a0aece80f0239109b5923ea9e))

### Tests

- add unit tests for updateModuleApiMenu functionality ([96e2607](https://github.com/jopyth/MMM-Remote-Control/commit/96e26075361d2fb53727b3615a45d334bf781ff0))

## [4.1.2](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.1...v4.1.2) (2026-01-04)

### Bug Fixes

- import formatName in API module to resolve TypeError ([6b6a002](https://github.com/jopyth/MMM-Remote-Control/commit/6b6a002b94eea3eff652c1eeb932ce09f7173540))

### Code Refactoring

- extract config management into lib/configManager.js ([9738742](https://github.com/jopyth/MMM-Remote-Control/commit/973874208f331f86912ae81474864c70ed77e48e))

## [4.1.1](https://github.com/jopyth/MMM-Remote-Control/compare/v4.1.0...v4.1.1) (2026-01-02)

### Bug Fixes

- **remote:** display custom menu submenu items correctly ([e21736a](https://github.com/jopyth/MMM-Remote-Control/commit/e21736ab4abfc9d165ddf33c80648f47f9f4e24c))
- **remote:** enable install button for modules regardless of installation status ([6c0d52a](https://github.com/jopyth/MMM-Remote-Control/commit/6c0d52aa145a1bb9d5681757f976b9f05838d00f))
- **remote:** raise z-index for temperature and brightness overlays ([bf29c6a](https://github.com/jopyth/MMM-Remote-Control/commit/bf29c6a9d0fd22dbc33f5a0f847197726b6c5c94)), closes [#374](https://github.com/jopyth/MMM-Remote-Control/issues/374)
- **remote:** send response when installing modules without dependencies ([a1dc147](https://github.com/jopyth/MMM-Remote-Control/commit/a1dc1470804090b5c436320028b3586a03c60c9a))

### Chores

- update actions/checkout to v6 in automated tests workflow ([f632396](https://github.com/jopyth/MMM-Remote-Control/commit/f632396732cfdc72907e125e1857a2426a4e7215))
- update devDependencies ([2ac3f79](https://github.com/jopyth/MMM-Remote-Control/commit/2ac3f79bc612e72629ba659b2111952eef21f891))

### Code Refactoring

- convert loadDefaultSettings, loadTranslation, and loadCustomMenus to async functions ([1502086](https://github.com/jopyth/MMM-Remote-Control/commit/15020863ecbba0ee46ea1719109ff0723cac912e))
- convert saveDefaultSettings to async and handle errors ([de5f092](https://github.com/jopyth/MMM-Remote-Control/commit/de5f092bd4b99c2e7f68346145b488214e06767a))
- convert sync fs operations to async/await ([3ecfdf5](https://github.com/jopyth/MMM-Remote-Control/commit/3ecfdf5baeed051eb3f01161b0d7221030fa6883))
- remove unused utility functions from node_helper ([7b69fd0](https://github.com/jopyth/MMM-Remote-Control/commit/7b69fd004a824d5cf7ef08d3f7624e6cfd5b84c2))

### Tests

- add unit tests for findBestBackupSlot functionality ([0b0caac](https://github.com/jopyth/MMM-Remote-Control/commit/0b0caac6105f330b8c7a75e1b1cf6fe78f5d5843))

## [4.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v4.0.3...v4.1.0) (2025-12-21)

### Features

- enforce JSDoc and add central type definitions ([e3f8222](https://github.com/jopyth/MMM-Remote-Control/commit/e3f82224aed24914a5b2cfd0ce64beebf6e7e51a))

### Bug Fixes

- **i18n:** add missing translation keys and remove 6 unused keys ([d69c8bd](https://github.com/jopyth/MMM-Remote-Control/commit/d69c8bdfae4729d1915c22955b0b65d41c530c58))

### Chores

- correct command in postinstall script for generating API key ([e0b9e96](https://github.com/jopyth/MMM-Remote-Control/commit/e0b9e96e5d58c174c28efaf1d5230cd748017413))
- update contributors format in package.json ([e4ac809](https://github.com/jopyth/MMM-Remote-Control/commit/e4ac809005b416bba408283717ac5de1cc68b4bd))

### Code Refactoring

- adopt upstream 3rd-party-modules schema ([368747e](https://github.com/jopyth/MMM-Remote-Control/commit/368747e85c8c08363030ac3e5b0496ed27282b8a))
- remove PM2 dependency, add universal process manager support ([1ebc12f](https://github.com/jopyth/MMM-Remote-Control/commit/1ebc12f73d98c55a677cdde59e71f510eb6b038a))
- rename folder to directory for constancy ([d998dcf](https://github.com/jopyth/MMM-Remote-Control/commit/d998dcf16486b00652b115dbcd3996ac3ab06aab))

### Tests

- add comprehensive tests for translation completeness and usage ([c6202a8](https://github.com/jopyth/MMM-Remote-Control/commit/c6202a8dc69c16d9a3abe0a0813e9a6836ae2053))

## [4.0.3](https://github.com/jopyth/MMM-Remote-Control/compare/v4.0.2...v4.0.3) (2025-12-20)

### Bug Fixes

- ensure smooth transition on first brightness/temp change ([f49da0c](https://github.com/jopyth/MMM-Remote-Control/commit/f49da0c5c3b34e509ebc870cf8d93a04b95f463f))

### Code Refactoring

- remove installer.sh and simplify installation ([2d2ee30](https://github.com/jopyth/MMM-Remote-Control/commit/2d2ee30d83c5fe49936ec1d7af30b2936a5c5353))

## [4.0.2](https://github.com/jopyth/MMM-Remote-Control/compare/v4.0.1...v4.0.2) (2025-12-20)

### Bug Fixes

- add express as devDependency for CI tests ([890933f](https://github.com/jopyth/MMM-Remote-Control/commit/890933f1766651a76c9d12e7551b1c4b0248beea))
- load saved brightness/temp values on remote page refresh ([4fa33fe](https://github.com/jopyth/MMM-Remote-Control/commit/4fa33feb0a47a88db4f2d48b8bfbcfa2b08fea69))
- preserve backdrop-filter during brightness transitions ([2c7d56d](https://github.com/jopyth/MMM-Remote-Control/commit/2c7d56da490da424cea595575382ec8f62827c44)), closes [#373](https://github.com/jopyth/MMM-Remote-Control/issues/373)
- **ui:** fix scrolling and consistent header height on small displays ([46f3e4a](https://github.com/jopyth/MMM-Remote-Control/commit/46f3e4ae29e4de73f5a3268f10c0016cccce3b98))

### Chores

- require Node.js >= 22.0.0 ([0ba3598](https://github.com/jopyth/MMM-Remote-Control/commit/0ba35982e785e49914aeefbbde00e8dcf9bcd6b1))

### Tests

- add test suite to GitHub Actions ([8029896](https://github.com/jopyth/MMM-Remote-Control/commit/802989666631cf3474de60925cbb4a89000c0385))

## [4.0.1](https://github.com/jopyth/MMM-Remote-Control/compare/v4.0.0...v4.0.1) (2025-12-19)

### Bug Fixes

- restore custom menu functionality after refactoring ([90520dc](https://github.com/jopyth/MMM-Remote-Control/commit/90520dcc7a6f1154b16e4a781f08e8ed9f7fdda3))

### Chores

- add 'navbutton' and 'qrcode' to cspell configuration ([8f3dc99](https://github.com/jopyth/MMM-Remote-Control/commit/8f3dc99e0c2980485a8716334b2e83d89e18cdb3))

## [4.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.3.2...v4.0.0) (2025-12-19)

This release is a huge step forward in modernizing the MMM-Remote-Control module, both in terms of user interface and code quality.

For users the most outstanding changes are the complete overhaul of the MMM-Remote-Control remote user interface and the new QR code feature - which simplifies connecting to the remote control interface via mobile devices.

There are also many under-the-hood improvements, including a comprehensive refactor of the codebase to modern JavaScript standards, enhanced error handling, and a significant expansion of the test suite to ensure reliability and maintainability going forward.

There should be no breaking changes in this release, but due to the extent of the changes, we decided for a major release and recommend testing the module thoroughly after updating.

### Features

- add `pointer-events: none` to temperature overlay to allow clicks/touch events to pass through ([30adf0e](https://github.com/jopyth/MMM-Remote-Control/commit/30adf0e0d09d0ec9bf6004500f3bc84410c9c491))
- add changelog button to module list ([a3ea01f](https://github.com/jopyth/MMM-Remote-Control/commit/a3ea01fab2f23e0e166f2d84a9e46cd1ec7dc976))
- add demo configuration file and add package.json script ([1110865](https://github.com/jopyth/MMM-Remote-Control/commit/111086552d34114946bf68eaf2c8287762ab8a86))
- add DOM tests and fix lockStrings handling ([aa7a3c8](https://github.com/jopyth/MMM-Remote-Control/commit/aa7a3c8a176440990d6c80b269893c766fb382e2))
- add PWA support ([ee2ccfa](https://github.com/jopyth/MMM-Remote-Control/commit/ee2ccfacdc0d51f011ada955b57d32814221da94))
- add QR code display and menu header icons ([467372e](https://github.com/jopyth/MMM-Remote-Control/commit/467372ebeb46b7480d105e63cca231866a9d68e4))
- add status badges and i18n for Classes menu ([20485df](https://github.com/jopyth/MMM-Remote-Control/commit/20485df91e1164ecb25acb97c62c5a9d9167a0b9))
- **remote:** add descriptions and repository buttons to add-module-menu ([c2e7388](https://github.com/jopyth/MMM-Remote-Control/commit/c2e7388830bd3c97b28271420a7f3fd78e499411))
- **remote:** add modern SVG favicon ([a3ccd57](https://github.com/jopyth/MMM-Remote-Control/commit/a3ccd570e0491c62f243e4348975b849c0910dfc))
- **remote:** add repository buttons to settings-menu ([635aab0](https://github.com/jopyth/MMM-Remote-Control/commit/635aab096324f0034354fc416c02f4de4dca8a09))
- **remote:** enhance menu headers with icons, sort main menu and new updates icon ([e672c11](https://github.com/jopyth/MMM-Remote-Control/commit/e672c11979a31d7b3779ef188c9754611358b463))

### Bug Fixes

- correct null check for alert button element ([4df9f8f](https://github.com/jopyth/MMM-Remote-Control/commit/4df9f8fcbeba2d8fbdedef09b45eb7cd377b212c))
- ensure callback execution on module hide/show actions ([5518aa4](https://github.com/jopyth/MMM-Remote-Control/commit/5518aa42e0b7989db6b109aa9b765d80bab3f926))
- ensure handleManageClasses always sends response ([cecb0ed](https://github.com/jopyth/MMM-Remote-Control/commit/cecb0edd386ef8d6c91c19552005dccb3d5356db))
- implement queue system for module update checks ([d2f95bd](https://github.com/jopyth/MMM-Remote-Control/commit/d2f95bdd806692ab527d478e525d2cd06728cae9))
- improve changelog display on module updates ([4226482](https://github.com/jopyth/MMM-Remote-Control/commit/4226482285b93df2362dba48f1dfd6e3877df27e))
- preserve backdrop-filter effect during brightness transitions ([f5eeb77](https://github.com/jopyth/MMM-Remote-Control/commit/f5eeb773fb70da803e2c1979166bc8d9dc61b0d3)), closes [#373](https://github.com/jopyth/MMM-Remote-Control/issues/373)
- resolve git pull fast-forward errors during module updates ([1910faa](https://github.com/jopyth/MMM-Remote-Control/commit/1910faa2539a0cc040bdf9baee22e9faec1f5633))
- update config backup tests and correct findBestBackupSlot logic ([d654505](https://github.com/jopyth/MMM-Remote-Control/commit/d654505d3cec0c07eb42626642ce3201f5fbdb94))

### Chores

- add eslint-plugin-jsdoc and improve documentation ([057c075](https://github.com/jopyth/MMM-Remote-Control/commit/057c0750682e57ca060c451baea4ba53c84f762c))
- raise coverage thresholds and add improvement strategy ([30e40de](https://github.com/jopyth/MMM-Remote-Control/commit/30e40de1b6fcdbd380d35d56c2c0f7ea687739c5))
- setup commit-and-tag-version ([533257b](https://github.com/jopyth/MMM-Remote-Control/commit/533257b430aef792af58c6cc9146b4f63c6127eb))

### Documentation

- add JSDoc for intentional error handling behavior ([3c62105](https://github.com/jopyth/MMM-Remote-Control/commit/3c62105abee918e430ff2169fc7937ee863140e0))

### Code Refactoring

- convert function expressions to arrow functions for consistency ([097a0b6](https://github.com/jopyth/MMM-Remote-Control/commit/097a0b64cec260cf1e5641f8cb94a4736e2dad55))
- convert HTMLCollections to Arrays for better compatibility ([9315724](https://github.com/jopyth/MMM-Remote-Control/commit/93157242c684cce917f9dce6cd8bf8c8deffd220))
- modernize answerPost with async/await and promises ([16f4473](https://github.com/jopyth/MMM-Remote-Control/commit/16f44738fe3a9ac8aad005baac7ba9175a728886))
- modernize callAfterUpdate with ES6+ features ([74060f7](https://github.com/jopyth/MMM-Remote-Control/commit/74060f7a7428e2e54a3b3eb3b881fbadfcb88eed))
- modernize for loops to modern iteration patterns ([c145f03](https://github.com/jopyth/MMM-Remote-Control/commit/c145f0373c734edf6872badfb6545c9ed0b66955))
- modernize JavaScript codebase to ES2020+ standards ([82cf674](https://github.com/jopyth/MMM-Remote-Control/commit/82cf674831d7c493afd4bbff57f4b03c28182b67))
- modernize module update workflow with async/await ([7145ae5](https://github.com/jopyth/MMM-Remote-Control/commit/7145ae5aef389ff2f40e139fad14ffa995f8840b))
- modernize Swagger UI documentation ([72acc35](https://github.com/jopyth/MMM-Remote-Control/commit/72acc35874a772d2c28ad7b8a4b35da1a6fe1bed))
- modernize updateModule() git operations ([0317e80](https://github.com/jopyth/MMM-Remote-Control/commit/0317e8079904f76377754c2d80e47faf57b9d769))
- preserve original module names ([dfd029f](https://github.com/jopyth/MMM-Remote-Control/commit/dfd029fe3dbae7a5bf193d90acc62836c65569b4))
- **remote:** comprehensive UI/UX modernization and code quality improvements ([5174ae4](https://github.com/jopyth/MMM-Remote-Control/commit/5174ae480e6fb07531a0fef2ea7c48b641183c2c))
- **remote:** harmonize styling for result lists ([5f14b16](https://github.com/jopyth/MMM-Remote-Control/commit/5f14b168013f2a4d62f8a6aeb5765bb66864bf13))
- **remote:** modernize add-entry handling ([f794f82](https://github.com/jopyth/MMM-Remote-Control/commit/f794f8295411523e21a0ba71ef21747696182b73))
- **remote:** move links menu buttons to menu-nav for consistent layout ([1c95add](https://github.com/jopyth/MMM-Remote-Control/commit/1c95add38ffdb3711f13f86e0f98515448e82056))
- **remote:** reorganize menu navigation for improved structure and clarity ([9d2a039](https://github.com/jopyth/MMM-Remote-Control/commit/9d2a039e787a95a8fdd5d51e91ad140c54b43252))
- **remote:** replace className manipulation with classList ([f091102](https://github.com/jopyth/MMM-Remote-Control/commit/f091102013a1005331eaaa67b327b6364fd55e40))
- remove module prefix from log messages ([76c2246](https://github.com/jopyth/MMM-Remote-Control/commit/76c2246ba59bf1b44687bf2551289ce63e01b660))
- remove unused formatLabel function and simplify label creation ([8462322](https://github.com/jopyth/MMM-Remote-Control/commit/8462322319438f56d6fc1cf0aabc4bc821db06da))
- replace if-chain with action handler map in executeQuery ([c20a864](https://github.com/jopyth/MMM-Remote-Control/commit/c20a864b5730563b6bbb6f9a0b1772893c6310a2))
- replace if-chain with data handler map in answerGet ([162cba3](https://github.com/jopyth/MMM-Remote-Control/commit/162cba38376c2fdffc185d3b12eec66e10154768))
- replace unmaintained `showdown` with `marked` ([0e3db68](https://github.com/jopyth/MMM-Remote-Control/commit/0e3db68d45e86fe62e7c27768586e1326c65e23a))
- simplify handleGetClasses with optional chaining ([959cfb0](https://github.com/jopyth/MMM-Remote-Control/commit/959cfb0174ec4b3081ae538485cef9f411dee941))
- simplify loadList to always return Promise ([d3991a3](https://github.com/jopyth/MMM-Remote-Control/commit/d3991a3aa0e4b360c2d1f9105578e0b6309e0d92))
- **translations:** rename "delete" action to "remove" and optimize styles ([388d677](https://github.com/jopyth/MMM-Remote-Control/commit/388d6779788b68e46a4071a75df38bb115c36957))

### Tests

- add alert handling and userPresence GET tests ([103c5ab](https://github.com/jopyth/MMM-Remote-Control/commit/103c5ab7ba195f16d22211fab9c4b73bd91d6236))
- add answerGet data assembly logic tests ([dba9de4](https://github.com/jopyth/MMM-Remote-Control/commit/dba9de4968a2c2c425edc2c263798efbec75918c))
- add comprehensive coverage for mergeData logic ([8853af5](https://github.com/jopyth/MMM-Remote-Control/commit/8853af501daed8a9e73efaeca6f1cdff6b23addc))
- add contract tests for /api/saves endpoint ([62cd0d6](https://github.com/jopyth/MMM-Remote-Control/commit/62cd0d631a6fefb5e77931309d0b491f31046f4d))
- add coverage for core executeQuery actions (batch 1) ([f057f94](https://github.com/jopyth/MMM-Remote-Control/commit/f057f94e7c41502cd3bd1ef10747ba4f7e1a293e))
- add coverage for executeQuery actions ([b4eae48](https://github.com/jopyth/MMM-Remote-Control/commit/b4eae488c11d3395cc85e4b6ffec49c7ff4112da))
- add edge case coverage for answerModuleApi ([0e5afe2](https://github.com/jopyth/MMM-Remote-Control/commit/0e5afe26734f8dac33dd4f2c4857625e3a2c265b))
- add error-path tests for executeQuery ([2def992](https://github.com/jopyth/MMM-Remote-Control/commit/2def992f66d19aacea87f4763145e95791f9eecc))
- add GET endpoint tests for brightness, temp, and defaultConfig ([7adb73a](https://github.com/jopyth/MMM-Remote-Control/commit/7adb73a6a0ec16164f8197fdf311af4ab71f0703))
- add HTTP-layer smoke tests for API endpoints ([f85693d](https://github.com/jopyth/MMM-Remote-Control/commit/f85693daa527ad47351eb3e3c474fda0781f2f3b))
- add schema validation for /api/module/available ([273fde2](https://github.com/jopyth/MMM-Remote-Control/commit/273fde286e81096bc568e81b1854953aa8b95cc7))
- clean up test suite hygiene ([ce66c63](https://github.com/jopyth/MMM-Remote-Control/commit/ce66c6323a860e3d53cdfcac5ede9b9260ec300f))
- **coverage:** expand unit tests for core helpers and handlers ([8c7cea0](https://github.com/jopyth/MMM-Remote-Control/commit/8c7cea09f1eb26399b1905d9c058e58b83d146d4))
- migrate timer mocking to Node's native mock.timers ([45dafb0](https://github.com/jopyth/MMM-Remote-Control/commit/45dafb0653055f704f3ad6a5f830c8fc23eb20c5))

## [3.3.2](https://github.com/jopyth/MMM-Remote-Control/compare/v3.3.1...v3.3.2) - 2025-12-13

### Changed

- chore: update devDependencies
- chore: handle prettier issue
- chore: handle cspell issues
- docs: update API documentation link in README
- fix(api): allow POST requests without Content-Type header when body is empty

## [3.3.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.3.0...v3.3.1) - 2025-12-12

### Changed

- chore: update dependencies
- docs: migrate wiki to docs/guide, simplify README

## [3.3.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.7...v3.3.0) - 2025-11-10

### Added

- feat: improve notification UX and PM2 error handling

### Changed

- chore: update dependencies
- chore: update Node.js setup action to v6
- docs: `npm run` -> `node --run`
- test: suppress noisy logs during test execution
- refactor: Switch module list from Wiki markdown to JSON API - solves [#336](https://github.com/Jopyth/MMM-Remote-Control/issues/336)

### Fixed

- fix: add null checks to prevent appendChild TypeError - fixes [#327](https://github.com/Jopyth/MMM-Remote-Control/issues/327)
- fix: add null-safety for configData.moduleData access
- fix: use cross-platform Node.js script for postinstall - fixes [#360](https://github.com/Jopyth/MMM-Remote-Control/issues/360)
- fix: use dynamic config path instead of hardcoded value - fixes [#328](https://github.com/Jopyth/MMM-Remote-Control/issues/328)

## [3.2.7](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.6...v3.2.7) - 2025-10-09

### Added

- tests: expand unit coverage for API helpers, delayed execution, persistence flows, and notification routing
- docs: add [tests/README.md](tests/README.md) to document the current stack, coverage focus, and roadmap

### Changed

- tests: raise coverage thresholds and include `API/**/*.js` in instrumentation while trimming brittle Express wiring suites
- docs: refresh README badges and testing guidance to point contributors at the new documentation
- chore: update dependencies

## [3.2.6](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.5...v3.2.6) - 2025-10-01

### Changed

- chore: add `simple-git-hooks` and `lint-staged` for pre-commit linting
- chore: update dependencies
- chore: update Node.js setup action to version 5
- chore: update stale action to version 10
- refactor: enhance issue templates for bug reports and feature requests

## [3.2.5](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.4...v3.2.5) - 2025-09-21

### Changed

- chore: update devDependencies
- docs: switch from `npm run` to `node --run`
- refactor: switch to `swagger-ui-dist`; remove overrides; silence install warnings

## [3.2.4](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.3...v3.2.4) - 2025-09-09

### Added

- feat(tests): add initial unit test & coverage foundation

### Changed

- chore: update dependencies
- refactor(css): remove redundant -webkit-appearance property

### Fixed

- chore: add `prismjs` override to resolve npm audit issue
- fix(ui): correct alignment of stacked monitor/edit icons and text spacing

## [3.2.3](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.2...v3.2.3) - 2025-09-01

### Changed

- chore: move "type" field to the correct position in package.json
- chore: remove engines field from package.json
- chore: remove unnecessary languageOptions from CSS configuration in ESLint
- chore: update dependencies

## [3.2.2](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.1...v3.2.2) - 2025-08-19

### Changed

- chore: update actions/checkout to v5 in automated tests workflow
- chore: add dependabot config for GitHub Actions and npm updates
- chore: update dependencies

## [3.2.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.2.0...v3.2.1) - 2025-07-11

### Changed

- chore: update dependencies

## [3.2.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.13...v3.2.0) - 2025-05-30

## Added

- style: add transition effect for brightness and temperature change

## Changed

- chore: add missing "type" field in `package.json`
- chore: update dependencies
- refactor: replace `git checkout` with `git switch` for branch/tag navigation
- style: simplify range input CSS

## Fixed

- fix: add onerror handling for CSS file loading due to path changes in MagicMirror 2.32.0

## [3.1.13](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.12...v3.1.13) - 2025-05-24

## Changed

- chore: switch stale workflow schedule to twice a week
- chore: update dependencies
- refactor: use `fs.constants.F_OK` for file access checks

## [3.1.12](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.11...v3.1.12) - 2025-05-20

### Fixed

- docs: correct config file path
- fix: ignore `settings.json` to prevent merge conflicts. This was accidentally removed in commit 6d7c85b12c8dce2ec772f9a9b1892b098576872f.
- fix: set `brightness` and `temp` for saving into `settings.json` and offering in API

### Changed

- refactor: centralize config path retrieval in `combineConfig` and `answerPost`

## [3.1.11](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.10...v3.1.11) - 2025-05-18

### Fixed

- fix: support Express v4 and v5 - to fix issue #340
  - The issue was introduced in 3.1.9, when the module was updated to be compatible with Express v5.
  - Since the new route definitions are not compatible with Express v4, the module will now check the version of Express and use the appropriate route definitions.

## [3.1.10](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.9...v3.1.10) - 2025-05-18

### Changed

- chore: re-add Prettier config (was removed in 3.1.9, but caused issues in GitHub actions)
- chore: update devDependencies
- docs: move images to own directory
- docs: update screenshots and add screenshot heading to README

## [3.1.9](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.8...v3.1.9) - 2025-05-17

### Changed

- chore: review linter setup
- chore: update devDependencies
- chore: update log messages for module default retrieval outputs
- docs: update URL to own wiki
- refactor: replace `body-parser` with express's built-in body parsing
- refactor: update route definitions and improve response handling to be compatible with express v5 (without this MMM-Remote-Control would not work with the next release of MagicMirror²)
- refactor: update scripts to use `node --run`

### Fixed

- fix: replace not working discussions URL with forum URL

## [3.1.8](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.7...v3.1.8) - 2025-04-27

### Changed

- refactor: choose installation command depending on the existence of `package-lock.json` and `package.json` This also fixes a problem that occurred with modules with `package.json` but without `package-lock.json` during installation with `npm ci`.
- refactor: don't save `header` to config file if not set
- refactor: get module defaults also from browser to handle bundled modules better (this will fix [#331](https://github.com/Jopyth/MMM-Remote-Control/issues/331))
- chore: update devDependencies

### Fixed

- fix: get default config while adding a module
- fix: don't save module position if not set. Since MM meanwhile checks the position values, an error message appears without this fix.

## [3.1.7](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.6...v3.1.7) - 2025-04-27

### Changed

- refactor: replace jQuery with vanilla JavaScript
- refactor: reorder `#alert` styles to remove rule from stylelint config
- chore: replace `npm install` with `npm ci --omit=dev` for less update issues and improved performance
- chore: update devDependencies

## [3.1.6](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.5...v3.1.6) - 2025-04-13

### Changed

- refactor: replace XMLHttpRequest by fetch
- chore: update English and German translations
- chore: more detailed logging
- chore: update dependencies
- chore: update ESLint configuration to use new import plugin structure
- chore: adjust ESLint rules
- docs: rephrase introduction in README

## [3.1.5](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.4...v3.1.5) - 2025-03-26

### Fixed

- fix: Refactor `setBrightness` and `setTemp`. To fix #322.

### Changed

- refactor: var -> let
- chore: Update devDependencies
- chore: Update modules.json.template

## [3.1.4](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.3...v3.1.4) - 2025-03-22

### Fixed

- fix: Prevent merge conflicts with `modules.json` while updating MMM-Remote-Control via `git pull` (#323)

### Changed

- chore: Update devDependencies
- chore: Refactor error logging in node_helper.js to include module context
- chore: Update bug report template to reflect new version placeholders

## [3.1.3](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.2...v3.1.3) - 2025-03-20

### Fixed

- fix: Only remove `classesButton` when it's there. There was a console error when returning to the main menu from a sub page.

### Changed

- chore: Remove unused `background-color` from `MMM-Remote-Control.css`
- chore: Use vw and vh instead of 100% in `MMM-Remote-Control.css`

## [3.1.2](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.1...v3.1.2) - 2025-03-11

### Fixed

- Fix temperature overlay to fit fullscreen

## Changed

- Update dependencies
- Remove old remote-control-overlay definition
- Simplify stylelint-prettier configuration

## [3.1.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.1.0...v3.1.1) - 2025-03-09

### Changed

- Handle cspell issues
- Refactor setBrightness Use filter instead an overlay
- Optimize slider - Allow 0 for brightness - Set default to center
- Handle linter warnings
- Refactor

## [3.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v3.0.1...v3.1.0) - 2025-03-09

### Added

- Added Color Temperature changing feature (#296) by @Andoramb

## [3.0.1](https://github.com/jopyth/MMM-Remote-Control/compare/v3.0.0...v3.0.1) - 2025-03-09

### Fixed

- Solve issue when not using standard config file (#320) by @dangherve

### Changed

- chore: Add @stylistic/eslint-plugin and handle linter issues
- chore: Replace eslint-plugin-import with eslint-plugin-import-x
- chore: Update devDependencies

## [3.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.4...v3.0.0) - 2025-03-04

There shouldn't be any breaking changes in this release. But since there are a some changes, which could lead to unexpected behavior, we decided to bump the major version.

### Fixed

- Fix action endpoint for modules #292

### Changed

- Use npm package for jQuery, showdown and swagger-ui (and switch to current versions)
- Update dependencies
- Handle some linter issues
- Drop Google fonts for API page

### Added

- Add compare links to CHANGELOG
- Add Code of Conduct

## [2.5.4](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.3...v2.5.4) - 2025-03-03

### Added

- Add prettier, markdownlint and stylelint to CI

### Changed

- Update dependencies

### Fixed

- Fix linting and formatter issues

## [2.5.3](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.2...v2.5.3) - 2025-01-20

### Fixed

- Fix `download_modules.js` script to automatically download the modules list from the MagicMirror² wiki. This will fix #301.

### Changed

- Replace `node-fetch` by internal fetch API
- Replace old python 2 script `download_modules.py` by JavaScript script, you can run it with `node --run download_modules` to download the modules list from the MagicMirror² wiki.
- Update `uuid`. This will fix #318.

## [2.5.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.1...v2.5.2) - 2025-01-18

### Fixed

- Fixed an issue with bundled modules (reported in #302) - the defaults of some bundled modules could not be read.
- Fixed/Updated some URLs.

### Changed

- Replaced `lodash` with built-in JavaScript functions.
- Format and handle some linting issues in `node_helper.js`.
- Switch LICENSE file to markdown for better readability.
- Update `devDependencies`.

## [2.5.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.5.0...v2.5.1) - 2024-12-17

### Fixed

- An error in the installation script. (Since MagicMirror² v2.27.0, the string used as TEST_STRING in `installer.sh` has changed and the installer script was not able to detect the MagicMirror² directory.)

## [2.5.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.4.0...v2.5.0) - 2024-11-20

### Added

- Added a spell checker and fixed problems that were found (#308).
- Added JavaScript linting (for the start with soft rules) (#310).
- Added GitHub workflow for linting and spell checking on every push and pull request (#310).
- Added Turkish language (#305)

## [2.4.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.8...v2.4.0) - 2024-10-08

### Fixed

- Module fixing. Thanks @khassel (#307)

## [2.3.8](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.7...v2.3.8) - 2023-10-03

### Added

- `node-fetch` now added to package.json (#293)

### Fixed

- Module name lookup now working as expected (#289)
- QOL Code Cleaning (#287)

## [2.3.7](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.6...v2.3.7) - 2022-10-13

### Added

- Header name to identify instances of modules (#283)

### Fixed

- API now grabs a single module, instead of every instance of the module (#282)

## [2.3.6](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.5...v2.3.6) - 2021-08-01

### Fixed

- API now updates the modules list

## [2.3.5](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.4...v2.3.5) - 2021-07-08

### Added

- Simplified Chinese translation
- 'PM2 not installed' warning

## [2.3.4](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.3...v2.3.4) - 2021-04-21

### Added

- Now you can use MANAGE_CLASSES to use them between modules, instead of just the API

### Fixed

- Classes now detects when you're using identifiers and names in the same action (#259)

## [2.3.3](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.2...v2.3.3) - 2021-04-05

### Changed

- `request` is deprecated inside MM package. Now using `node-fetch` (#257)

## [2.3.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.1...v2.3.2) - 2021-02-19

### Fixed

- `value` now travels along with the payload when slide or input it's used on Custom Menus. (#251)

### Changed

- If you use slide or input, and you add a string payload, it'll now be available in the `string` object of the payload.

## [2.3.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.3.0...v2.3.1) - 2020-12-29

### Fixed

- `Find` it's not defined inside some Electron instances (#242 and #235)
- `undefined` modules generated by the `disabled` tag are now handled. (MagicMirrorOrg/MagicMirror#2382)

## [2.3.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.2...v2.3.0) - 2020-12-23

### Added

- Custom Shell Commands for everyone! (#159)
- Custom Menus: User Input Field (#181) and Sliders

### Fixed

- "TV is off" now detected (#234)
- Toggle and Status Monitor working as expected (#234)

### Changed

- Now the system used for turn on and off the screen will be `vcgencmd` (#227 and more)

## [2.2.2](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.1...v2.2.2) - 2020-11-24

### Fixed

- Module Installation now working
- iframe now working (#161)

## [2.2.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.2.0...v2.2.1) - 2020-11-18

### Fixed

- Module Identifier now working as expected (#229)
- Update Installation seems to work

## [2.2.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.1.0...v2.2.0) - 2020-11-16

### Fixed

- Default values now removed from backup (#12)
- Custom Menus now works as expected
- API working, not well implemented in the past
- API userPresence now working as expected

### Added

- Updates now show if there's an update available every day (#52)
- Templates for issues and PRs, and also stale for auto management of issues.
- Close Dev Tools (#119)
- Undo Config Implementation (Beta)
- Classes to show, hide or toggle multiple modules at once (#34)
- Classes and saves API
- Changelog of every module updated
- [Showdown](https://github.com/showdownjs/showdown) implemented in order to show changelog markdown.
- secureEndpoint config to bypass the non-apikey limitation. This could be dangerous, use it with caution.
- Added POST support for Monitor API (#200)
- Added endpoint to edit config file (#206)
- Endpoint /api/docs now shows you the documentation available for the API. You can test your mirror right there!

### Changed

- **[lodash](https://lodash.com/) required**. Do `npm install` on the Remote Control module.
- Alert button don't show up when Alert module isn't active
- The way monitor turn on and off (#225)
- Now hide, show or toggle modules also accept arrays
- /api/test can be reach without any apiKey
- /api/modules/installed and /available are now /api/module/installed and /available
- ApiKey required in order to change substantial things on the Mirror
- Some Endpoints are gonna be deprecated in the future. You can see those inside /api/docs, in the Legacy menu.

### Removed

- /api/modules it's no longer available, you can use /api/module instead.
- Postman collection deprecated ~ (Sorry n.n)

## [2.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v2.0.1...v2.1.0) - 2020-11-01

Hello! Ezequiel here. Just wanted to say thanks for trust in me, in the past days I made a lot of changes into the code, adding some functions that'll surely be in a future release, and also putting everything together in my fork. I answered almost every issue raised, and tried to help every person that use this module. Today, I'm glad to be able to share everything I learned to all of you. I apologize for some fast and uncommented commits, I just thought that some things needed to be fixed ASAP.
See you in future commits, issues and PRs :D

### Fixed

- A typo in `es` translation
- A few typos in README.md (#134 and #149) and API/README.md (#179)
- Delayed commands should now work (#190)
- Typo on remote_action (#184)
- IP now showing (#194)
- MM restart button don't just stop anymore (#126)
- Saving config should work as expected now (#153)
- installer.sh now detects where's the node installation (#222)

### Added

- Danish translation (#157)
- Italian translation (#162)
- Port now showing according to config.js (#98)
- Custom commands for shutdown and reboot

### Changed

- Overwrite of local changes when updating from a repository
- Now requires MagicMirror² version 2.12

## [2.0.1](https://github.com/jopyth/MMM-Remote-Control/compare/v2.0.0...v2.0.1) - 2020-10-28

**Huge thanks to [@ezeholz](https://github.com/ezeholz)** who has offered to maintain the module from now on!
Credit for this (and future) versions and releases goes to @ezeholz (unless noted otherwise).

Now requires MagicMirror² version 2.7.

### Fixed

- Path to font awesome icons
- A few typos in `ca` and `es` translations
- Updates to `remote.html` to support new `basePath` feature in MM `config.js`, [follow up to this MM issue](https://github.com/MagicMirrorOrg/MagicMirror/issues/1973), related to #185

## [2.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.5...v2.0.0) - 2019-02-21

Huge shout out to [shbatm](https://github.com/shbatm) for his work on this new major version, which brings a new API, custom menus and commands and lots of other stuff:

### Added

- REST API interface for controlling all aspects of the MagicMirror² from HTTP RESTful-style GET and POST calls, based on principles from [MMM-Api](https://github.com/juzim/MMM-Api)
  - Full API Documentation at [API/README.md](API/README.md)
- Live daily updates of `modules.json` from the MagicMirror² wiki, based on principles from [MMM-Remote-Control-Repository](https://github.com/eouia/MMM-Remote-Control-Repository).
- Incorporated some features found in [MMM-OnScreenMenu](https://github.com/shbatm/MMM-OnScreenMenu) that were not originally in this module.
  - Monitor (Connected Screen) On-Off Status and Toggle
  - Delayed calls ("DELAYED" Query option and `.../delay` API paths)
  - If using Electron: Open Dev Tools, Minimize, Toggle Fullscreen
- Configuration Option to send custom shell commands to use. Currently, only custom monitor on/off/status commands are supported.
- Module Control menu - Automatically generated from the API to control the different modules you have installed, based on their `notificationReceived` function.
- Custom menu items. See [Custom Menu Items in README](README.md#custom-menu-items)
- Norsk bokmål translation

### Changed

- Updates to `remote.html` and the `node_helper.js` to use direct SocketIO communication back and forth instead of separate HTTP calls.
  - Future framework for following PM2 logs and more live update options.
- General clean-up and standardization of status reporting for GET and POST calls, to original URLs and to new API URLs.
- Updated to ES2015 (ES Version 6) function calls in most locations.
- Added USER_PRESENCE controls from [AgP42](https://github.com/AgP42)
- Added/updated french translations from [BKeyport](https://github.com/Bkeyport) and [Mysh3ll](https://github.com/Mysh3ll)
- Added SHOW/HIDE/TOGGLE ALL modules option per request from [Rene1709](https://github.com/Rene1709)

### Upcoming Changes

- Add additional MMM-OnScreenMenu features:
  - Moving modules' positions
- PM2 Log Follower / Terminal Window
- Added Notification Echo option to config to echo all Module Notifications to the remote's DevTools console for debugging.
- Allow for text input in the Module Controls menu to be able to provide a notification payload.

## [1.1.5](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.4...v1.1.5) - 2018-05-14

### Added

- French translation

### Fixed

- Updated documentation to new MagicMirror² version
- Fix error on updating MagicMirror²

## [1.1.4](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.3...v1.1.4) - 2017-09-17

### Added

- Dutch translation
- Updating a module tries to install dependencies with `npm install`
- Module identifier is shown if a module is locked with lock strings
- Confirmation dialog before restart and shutdown

### Fixed

- Internal save file format and mistakenly hiding modules which were hidden by other modules
- Restart should work for new installations

### Changed

- German translation for power menu changed from "Ausschalten" to "Energieoptionen"

## [1.1.3](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.2...v1.1.3) - 2017-04-23

### Added

- Portuguese translation
- Indonesian translation
- Support for iOS Icon and Webapp

### Changed

- Installation no longer needs a temporary file

### Fixed

- Icon paths adapted to changes in [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) 2.1.0

## [1.1.2](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.1...v1.1.2) - 2017-02-01

**Note:** Since version 1.1.0 this module uses (new) dependencies, check the [Updating section in the README.md](README.md#update).

### Added

- Swedish translation

### Changed

- Installation process updated in [README.md](README.md#Installation)
- Automatic installer/updater includes hint to restart [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)

### Fixed

- Issues with not applying shown and hidden status correctly to modules
- Issues where lockstrings were missing
- Modules sometimes did not show correctly in the UI as hidden or shown:
  - This is due to a bug in [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror)
  - PR [#659](https://github.com/MagicMirrorOrg/MagicMirror/pull/659) to fix this was made in the project, will be released in the next version

## [1.1.1](https://github.com/jopyth/MMM-Remote-Control/compare/v1.1.0...v1.1.1) - 2017-01-26

### Changed

- Updated internal list of available modules

## [1.1.0](https://github.com/jopyth/MMM-Remote-Control/compare/v1.0.0...v1.1.0) - 2017-01-26

### Added

- First version of installer script
- Menu to send Alerts and/or Notifications to your mirror
- Menu to update your MagicMirror² installation and your modules (through `git pull`)
- Menu to change the `config.js`
  - Modules can be installed, added, removed, configured
  - There will be backups of the five last versions of the `config.js` in the `config` directory
  - Some of these parts are hidden behind an "experimental" warning, do **not** ignore that warning
- NOTIFICATION action, see [README.md](README.md#notification-request) for details

### Changed

- Menu structure
  - Old "Edit" and "Settings" are now under "Edit view"
- Smaller font sizes in lists

### Fixed

- Issues coming from disabled modules since MM version 2.1.0

## [1.0.0](https://github.com/jopyth/MMM-Remote-Control/compare/v0.1.0...v1.0.0) - 2016-10-24 - First Official Release

### Added

- Changelog
- New buttons in user interface
  - Hide/show all modules
  - Link to MagicMirror² homepage
  - Option to adapt brightness (making the mirror brighter than 100% can be limited to certain modules)
- Contributing hints
- Internal versioning of saved config (current version: 1)
- Added action `MODULE_DATA` to return module data in JSON format

### Changed

- Internal timeout for commands increased from 5 to 8 seconds
- Symbols for display on and off
- Internal changes in preparation for MagicMirror² version `2.1.0`

## [0.1.0](https://github.com/Jopyth/MMM-Remote-Control/releases/tag/v0.1.0) - 2016-09-30

Initial release of the Remote Control module.
