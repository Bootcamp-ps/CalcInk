# CalcInk — Agent Rules

CalcInk is a 100% client-side, offline, handwritten math calculator (Inter IIT Bootcamp, Software PS).
Users write e.g. `18+4×3=` with a pen/mouse/touch; the app recognises it and draws the answer next to the `=`.

## Source of truth (read before coding)
- `docs/PRD_canvas_ux.md` — requirements, priorities (P0/P1/P2), design and test plan for the canvas/UX layer. **Follow it.**
- `docs/reference/calcink_architecture.md` — a teammate's architecture for recognition, parser and the original canvas. Use as reference, not law. The PRD wins on conflicts. Do not touch recognition or parser design.

## Stack
Vite + React 18 + TypeScript (strict) + Vitest. Plain CSS with CSS variables. No UI kits.
Ink smoothing: `perfect-freehand`. Autosave: IndexedDB (`idb-keyval`). Fonts: `@fontsource/inter`, `@fontsource/caveat`.

## Hard constraints (never violate)
1. **Offline and on-device only.** No CDN links, no Google Fonts, no remote images, no fetch to any external host, no analytics. Every asset is bundled.
2. **No backend, no database.** Local persistence only (IndexedDB / memory).
3. **Never use `eval()` or `new Function()`.**
4. **Keep the main thread free while drawing.** `pointermove` must only push samples and schedule one `requestAnimationFrame`. No heavy sync work, no per-point React state updates (use refs).
5. **No memory leaks:** cap undo history at 100, remove every listener/observer/timer on cleanup, keep caches in `WeakMap` or bounded maps.
6. **Never throw unhandled exceptions** from input handlers; guard multi-touch, resize mid-stroke, and rapid tool switching.
7. Ink colour/width must never affect recognition input.

## Folder ownership (do not edit outside your task's folder without saying so)
- Canvas owner (this agent's default scope): `src/canvas/`, `src/overlay/`, `src/components/`, `src/styles/`, `src/audio/`, and their tests.
- Others own: `src/recognition/`, `src/workers/`, `src/parser/`. Integrate only through `src/contract.ts`.
- `src/contract.ts` and `src/App.tsx` wiring are shared: keep changes minimal and explain them.

## Architecture rules
- `StrokeStore` is framework-agnostic (no React imports), pub-sub, immutable `Stroke` objects, actions: `add | remove | replace | clear`.
- Layers: paper (CSS) → `stroke-canvas` (committed ink) → `live-canvas` (current stroke, receives pointer events) → DOM overlay (answers, dots, cursor, `pointer-events: none`).
- Store coordinates in CSS pixels; one tested function converts client → canvas coordinates. Handle `devicePixelRatio` and DPR changes.
- Rendering: draw only the new stroke on commit; full redraw only on undo/redo/erase/clear/resize/theme change; cache `Path2D` per stroke in a `WeakMap`.
- Answers are DOM elements animated with `transform`/`opacity` only.

## Code style
- TypeScript strict, no `any` without a comment. Small modules, one responsibility each, JSDoc on public functions.
- Name files by role (`strokeStore.ts`, `inkRenderer.ts`). No giant components: split above ~200 lines.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Workflow
1. Before coding a task, state a short plan and list the files you will touch.
2. Work on one PRD item (FR-x) at a time; mention its ID in commits.
3. Write or update unit tests with the code (Vitest). Run `npm run test` and `npm run build` before declaring done; fix failures, don't skip them.
4. Commits: conventional style, e.g. `feat(canvas): add pressure-aware ink renderer`. Small commits.
5. Do not add dependencies without saying why, and check the licence is MIT/Apache/BSD/OFL. Prefer fewer dependencies.
6. Do not refactor or delete files outside the task. Do not commit model files, large binaries or `node_modules`.
7. When finished, report: what changed, how to verify it manually, what is left or risky.

## Definition of done for any task
Tests green, build passes, no console errors, works with mouse and touch, works offline (no network requests), no new long tasks while drawing.
