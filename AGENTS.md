# CalcInk — Agent Rules

> Draft v1. The "Hard constraints" come from the problem statement (PS). Folder ownership, stack and
> architecture notes are **proposals**: anyone on the team may change them through a pull request.

CalcInk is a 100% client-side, offline, handwritten math calculator (Inter IIT Bootcamp, Software PS).
Users write several equations, e.g. `18+4×3=` then `4-3=` on the next line, with a pen/mouse/touch;
the app recognises each row and draws its answer right next to that row's last `=`.

## Source of truth (read before coding)
- `docs/PRD_canvas_ux.md` — requirements, priorities (P0/P1/P2), design and test plan for the canvas/UX layer. **Follow it for canvas work.**
- `docs/reference/calcink_architecture.md` — a teammate's architecture for recognition, parser and the original canvas. Reference, not law. The PRD wins on canvas conflicts. Do not redesign recognition or the parser.

## Stack (proposed)
Vite + React 18 + TypeScript (strict) + Vitest. Plain CSS with CSS variables. No UI kits.
Ink smoothing: `perfect-freehand`. Autosave: IndexedDB (`idb-keyval`). Fonts: `@fontsource/inter`, `@fontsource/caveat` (latin subsets only).

## Hard constraints (never violate)
1. **Offline and on-device only.** No CDN links, no Google Fonts, no remote images, no fetch to any external host, no analytics. Every asset is bundled.
2. **No backend, no database.** Local persistence only (IndexedDB / memory).
3. **Never use `eval()` or `new Function()`.**
4. **Keep the main thread free while drawing.** `pointermove` must only push samples and schedule one `requestAnimationFrame`. No heavy sync work, no per-point React state updates (use refs).
5. **No memory leaks:** cap undo history at 100, remove every listener/observer/timer/rAF on cleanup, keep caches in `WeakMap` or bounded maps.
6. **Never throw unhandled exceptions** from input handlers; guard multi-touch, resize mid-stroke, and rapid tool switching.
7. Ink colour/width must never affect recognition input. Recognition receives raw points.

## Folder ownership (proposed)
- Canvas owner (this agent's default scope): `src/canvas/`, `src/overlay/` (answer layer, debug overlay), `src/components/`, `src/styles/`, `src/audio/`, and their tests.
- Others own: `src/recognition/`, `src/workers/`, `src/parser/`. Integrate only through `src/contract.ts`.
- `src/contract.ts` and `src/App.tsx` wiring are shared: keep changes minimal and explain them.

## Architecture rules
- `StrokeStore` is framework-agnostic (no React imports), pub-sub, immutable `Stroke` objects, actions `add | remove | replace | clear`, a monotonically increasing `version`, and a way to report which stroke ids changed.
- **Strokes are the source of truth, pixels are not.** Recognition, undo, erase, autosave and export all work from stroke data.
- **Layers (bottom to top):** paper (CSS + generated texture) → `stroke-canvas` (committed ink) → `live-canvas` (current stroke; receives pointer events) → `answer-canvas` (answers, confidence dots, stale/reading states; `pointer-events: none`). A visually hidden `aria-live` text mirrors the answers for screen readers.
- **Multiple rows:** the page holds several equations. Recognition groups symbols into rows; every result carries a `rowId`. The canvas anchors each row's answer to that row's last `=` symbol (computed from the stroke ids of that symbol group). Answers must never overlap other ink.
- **Fixed-size page for now.** Coordinates are CSS pixels in page space so scrolling can be added later without a rewrite. Never allocate canvases larger than the viewport × DPR.
- Store coordinates in CSS pixels; one tested function converts client → canvas coordinates. Handle `devicePixelRatio` and DPR changes.
- Rendering: draw only the new stroke on commit; full redraw only on undo/redo/erase/clear/resize/theme change; cache `Path2D` per stroke in a `WeakMap`. The answer layer redraws only when answers change, and only runs rAF while a transition is animating (≤ ~300 ms).
- Recognition results carry the store `version` they were computed for; discard them if the store has moved on.

## Code style
- TypeScript strict, no `any` without a comment. Small modules, one responsibility each, JSDoc on public functions.
- Name files by role (`strokeStore.ts`, `inkRenderer.ts`, `answerRenderer.ts`). Split components above ~200 lines.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.

## Workflow
1. Before coding a task, state a short plan and list the files you will touch.
2. Work on one PRD item (FR-x) at a time; mention its ID in commits.
3. Write or update unit tests with the code (Vitest). Run `npm run test` and `npm run build` before declaring done; fix failures, don't skip them.
4. Commits: conventional style, e.g. `feat(canvas): add pressure-aware ink renderer`. Small commits.
5. Do not add dependencies without saying why, and check the licence is MIT/Apache/BSD/OFL. Prefer fewer dependencies.
6. Do not refactor or delete files outside the task. Do not commit model files, large binaries, `dist/` or `node_modules`.
7. When finished, report: what changed, how to verify it by hand, what is left or risky.

## Definition of done for any task
Tests green, build passes, no console errors, works with mouse and touch, works offline (no network requests), no new long tasks while drawing.
