# Screenshot Board Implementation Plan

**Goal:** Build dsh-screenshot-board 0.1.0 as an npm tarball only, with screenshot annotations, editable tasks, durable boards, portable handoff ZIPs and before/after acceptance.

**Architecture:** A Node Host uses only the locally verified webServer.register + ctx.effect pattern. A single self-contained browser bundle registers via window.__ModuleLoader__.load and adds a settings.section and shell.overlay launcher using the patterns in dsh-pet and dsh-mobile-plugin. A standalone local preview uses the same UI and route handler without loading or installing DSH. Runtime data stays under the DSH home, outside associated projects.

**Files involved:** package.json; cordis.patch.yml; src/core/{board,export,zip}.js; src/host/{index,router,storage}.js; src/client/{index,app}.js; src/client/style.css; scripts/{build,preview,check-package}.mjs; tests/*.test.mjs; README.md; docs/API-EVIDENCE.md.

## Task 1 — Package and verified DSH contract
- Record exact local source evidence, manifest exports, inject services and patch row.
- Check package-name equality, local entry existence and absence of runtime client imports.

## Task 2 — Board model and storage
- First write tests for normalized rectangles, identity, imported documents, status transitions, revision conflicts and serialized writes.
- Implement validation, atomic writes, bounded raster uploads, project path as metadata only, and CRUD routes.
- Run: node --test tests/core.test.mjs tests/storage.test.mjs

## Task 3 — Portable handoff
- Test Markdown escaping, ZIP CRC/header and traversal rejection, persisted archive contents.
- Export original and annotated PNGs, tasks.md, board.json and optional after image. Import a portable JSON document with embedded images.
- Run: node --test tests/export.test.mjs tests/router.test.mjs

## Task 4 — Browser workspace
- Build a three-column workspace with a board list, zoomable image/normalized rectangle editor and editable task inspector.
- Support upload/drop/paste, sample board, fit/zoom/pan, task filtering/reorder, persistent edits, history and acceptance with a separate after image.
- Verify user flows in the local preview through a browser; do not install the plugin in DSH.

## Task 5 — Build and package
- Use locally available esbuild for development without installing dependencies; document ordinary npm install/build for maintainers.
- Generate self-contained lib/client.js and Node lib/index.js. Verify exports, bundle imports and npm pack inventory.

## Task 6 — Review and delivery
- Review error paths, input validation, local route access, stale edits, image lifetimes and archive portability.
- Run all meaningful tests and browser interaction checks, inspect screenshots, then npm pack into dist.
- Deliver absolute paths, preview instructions and the explicit limitation that actual DSH runtime integration has not been installed/tested.

## Assumptions and scope
- No automatic CLI dispatch, AI task rewriting, screenshot capture, repository mutation or DSH profile writes in v0.1.0.
- Manual PNG/JPEG input, numbered rectangles, editable titles/requirements/acceptance and task status are the core workflow.
- A failed check is fixed and rechecked; user-facing progress is reported between batches while continuing authorized work.

## Completion record
All six implementation tasks are complete. Delivered npm tarball: dist/dsh-screenshot-board-0.1.0.tgz (37,757 bytes, 8 whitelisted entries). SHA-256: 89437e6b7dc28cab4eca4c180924111ba1718a107d8fedc6c24c2734188a9e90.

Validation: 11 Node tests, 13 Chromium user flows with no page errors, real ZIP CRC and image-decoding verification, and built Client loader/slot contract checks passed. Actual DSH installation/live integration was intentionally not attempted. Local preview processes used for verification were stopped. Default preview data was kept separate from test/demo evidence.