# CalcInk: Canvas, Ink & UX — Product Requirements Document

| | |
|---|---|
| **Owner** | Canvas / UI-UX / live result projection |
| **Project** | Inter IIT Bootcamp, Software PS: CalcInk (100% client-side) |
| **Status** | Draft v2, 1 Oct 2026 (scaffold done on `feat/canvas-scaffold`) |
| **Submission deadline** | 7 Oct 2026 (internal feature freeze: 6 Oct) |
| **Related docs** | PS PDF (source of truth), `docs/reference/calcink_architecture.md` (teammate's reference architecture) |

> Everything here covers the canvas/UX layer only. Folder ownership, stack and the contract are proposals; the team can change them by pull request.

---

## 1. Purpose

Deliver the part of CalcInk the user touches: a fast, beautiful, stylus-friendly digital-paper canvas where several handwritten equations can be written, edited and erased, and where each equation's answer appears inline next to its own `=` and updates live when the equation changes.

Recognition (model, symbol grouping, row detection, worker) and the arithmetic parser belong to the teammates' part. This PRD covers everything from **pointer input to pixels on screen**, plus **projecting each row's result back onto the page**.

### 1.1 Goals
1. Satisfy every canvas-related *required* feature in the PS, with tests.
2. Hold 60 FPS and zero perceptible pen lag while recognition runs.
3. Support **several equations on one page** (write `2+3=`, then `4-3=` below it) without creating a new page.
4. Maximise the **Creativity & UX (20 pts)** score with a small number of polished, cheap-to-build extras.
5. Contribute clearly to Performance (20), Architecture doc (20) and Teamwork (15).

### 1.2 Non-goals
- No backend, accounts, sync or collaboration (storage is local only).
- No whiteboard features: shapes, text boxes, images, layers panel, zoom.
- No ML work; no change to the recognition model.
- No scrolling / infinite page in v1 (see D4). Mouse and stylus are the focus; multi-touch gestures are not.

### 1.3 Decisions (settled)
| # | Decision | Why |
|---|---|---|
| D1 | Own thin canvas layer + `perfect-freehand`; no whiteboard library | Full control of stroke data, 60 FPS and answer placement; tiny bundle |
| D2 | **Answers live on their own `answer-canvas` layer** (not DOM, not on the ink canvas) | Matches the PS wording ("on the canvas surface"), keeps ink untouched while answers animate, makes PNG export a simple layer composite |
| D3 | **Multiple rows on one page**, each answer anchored to its own `=` | Required by the demo flow; recognition already plans row detection |
| D4 | **Fixed-size page first**; coordinates in page space so scrolling can come later | Biggest simplification; avoids unbounded canvas memory |
| D5 | Mouse is a first-class input; pressure is simulated; stylus extras are polish | Judges will likely use a mouse |

---

## 2. Rubric mapping

| Rubric pillar (PS) | Points | How this part contributes |
|---|---|---|
| Feature implementation & test suites | 25 | All canvas features (smooth drawing, undo/redo, stroke + pixel eraser, clear, width, DPR); unit tests for coordinates, store, eraser, answer placement, export |
| Idea & architecture document | 20 | Canvas section of README: layers, data model, rendering pipeline, library justification and rejected alternatives |
| Performance & runtime | 20 | rAF-batched input, cached `Path2D`, layered canvases, nothing heavy on pointer move, bounded undo, offline verified |
| Teamwork & engineering | 15 | Folder ownership, feature branches, small PRs, conventional commits |
| Creativity & UX | 20 | Paper aesthetic, pressure-aware ink, animated answers, ruled rows, confidence dots, sound/haptics, scratch-to-erase, export |

---

## 3. Users & demo scenarios

- **Judge with a mouse**: must work flawlessly.
- **Tablet / stylus user**: gets pressure, eraser end, palm rejection.
- **Demo script (90 s):** write `18+4×3=` → answer fades in → write `4-3=` on the next line → answer appears on that row only → erase the `3` in row 1, write `5` → only row 1 updates (old answer dims, new one cross-fades) → write `5÷0=` → "Undefined" → scratch out a term → switch paper → undo/redo → export PNG → toggle airplane mode and repeat.

---

## 4. Scope and priorities

**P0: required baseline**
- Ink canvas with mouse / touch / pen via Pointer Events
- Undo / redo, stroke eraser, pixel eraser, clear, width control
- High-DPI crispness (`devicePixelRatio`)
- Per-row inline answers next to each `=`, live re-evaluation on edit
- Unit tests, 60 FPS, offline

**P1: high value, low cost**
- Pressure / velocity-aware smooth ink (`perfect-freehand`)
- Paper themes (ruled by default, plus plain / grid / dot / dark) with generated texture
- Colour swatches and width presets
- Animated answer reveal; stale / reading / error states
- Per-symbol confidence dots; `?debug` overlay (symbol boxes, row bands)
- Stylus niceties: eraser end, hover cursor, palm rejection
- Export PNG + SVG; autosave to IndexedDB
- Self-hosted fonts; sound + haptics (toggleable); keyboard shortcuts; dev FPS meter

**P2: stretch**
- Scratch-to-erase gesture
- "Show steps" (BODMAS reduction chain); tap an answer to copy
- Tap-a-symbol to correct recognition (needs top-k from recognition)
- Scrollable page, variable memory (`x = 10`), 2D plotting (depend on recognition vocabulary)

---

## 5. Functional requirements

### 5.1 Ink canvas and input
| ID | Requirement | Pri |
|---|---|---|
| FR-1 | Draw with mouse, touch and pen through Pointer Events with `setPointerCapture`; canvas has `touch-action: none` | P0 |
| FR-2 | Capture `pressure`; use `getCoalescedEvents()` when available so fast strokes keep all samples | P1 |
| FR-3 | Strokes render smoothly while drawing and after commit; live and committed look identical (no "pop" on pen lift) | P0 |
| FR-4 | With constant-pressure input (mouse) simulate pressure from velocity | P1 |
| FR-5 | Palm rejection: once a `pen` pointer has been seen, ignore `touch` for drawing; mouse always allowed | P1 |
| FR-6 | Pen eraser end / barrel button (`buttons & 32`) temporarily switches to stroke eraser | P1 |
| FR-7 | Hover (pen / mouse with no buttons) shows a brush-size cursor ring | P1 |
| FR-8 | Canvases resize with the window and re-rasterise crisply; DPR changes (monitor move, browser zoom) are detected and handled | P0 |
| FR-9 | Coordinates stored in CSS pixels in page space; one tested function converts client → page coordinates | P0 |
| FR-9b | The page has a fixed logical size chosen at load (fits the viewport); canvas memory never exceeds viewport × DPR | P0 |

### 5.2 Tools and history
| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Tools: pen, stroke eraser, pixel eraser (radius adjustable) | P0 |
| FR-11 | Undo / redo (capped at 100), clear canvas (undoable) | P0 |
| FR-12 | Width: slider plus 3 presets (fine / medium / bold) | P0 / P1 |
| FR-13 | Colour: 4–5 swatches. Colour and width never change recognition input (recognition gets raw points) | P1 |
| FR-14 | Pixel eraser cuts stroke points inside the eraser circle (splitting strokes after inserting points along long segments); undo stores only the changed strokes (before / after) | P0 / P1 |
| FR-15 | Scratch-to-erase: a fast zig-zag over existing ink deletes the strokes it covers as one undoable action; normal symbols never trigger it | P2 |

### 5.3 Paper and visual design
| ID | Requirement | Pri |
|---|---|---|
| FR-16 | Paper surface with subtle texture and soft vignette, generated in code (no network assets) | P1 |
| FR-17 | Themes: **ruled (default)**, plain, grid, dot, dark "chalkboard". Rule spacing is the row height guide | P1 |
| FR-18 | UI in Inter, answers in Caveat, both self-hosted (`@fontsource`, latin subsets); canvas text drawn only after `document.fonts.load()` resolves | P1 |
| FR-19 | Responsive layout: toolbar at the side on desktop, bottom on tablet / phone; touch targets ≥ 44 px | P1 |
| FR-20 | Respect `prefers-reduced-motion` and `prefers-color-scheme` | P1 |

### 5.4 Answers, rows and reactive editing
Layers (bottom to top): `paper` → `stroke-canvas` → `live-canvas` → `answer-canvas`.

| ID | Requirement | Pri |
|---|---|---|
| FR-21 | For every row, the answer is drawn on `answer-canvas` immediately right of that row's last `=`, vertically centred on it, with font size scaled to the written symbols' height | P0 |
| FR-22 | Editing a row re-evaluates **only that row**: its old answer dims (stale) until the new one arrives, then cross-fades. No flicker, no blank gap, other rows untouched | P0 / P1 |
| FR-23 | Division by zero shows **Undefined**; syntax errors / unreadable rows show a muted "?"; nothing throws | P0 |
| FR-24 | Collision rule: an answer never overlaps ink or the next row. If no room to the right, shrink slightly, then nudge; always stay inside the page | P1 |
| FR-25 | Subtle pulsing "reading…" dot beside the `=` while the worker runs on that row | P1 |
| FR-26 | Per-symbol confidence dots (green / amber / red) drawn on `answer-canvas`, toggleable | P1 |
| FR-27 | "Show steps" for an answer (BODMAS chain `18 + 4×3 → 18 + 12 → 30`); tap answer to copy (hit-test on `answer-canvas`) | P2 |
| FR-28 | A visually hidden `aria-live="polite"` element mirrors the current answers for screen readers | P1 |
| FR-29 | `answer-canvas` redraws only when answers change and runs `requestAnimationFrame` only while a transition is animating (≤ ~300 ms); it is idle otherwise | P1 |
| FR-30 | Rows with no `=` get no answer and no error (free writing is allowed) | P0 |
| FR-31 | Writing a new equation on the next line never changes the earlier rows' answers | P0 |
| FR-32 | `?debug` overlay draws symbol boxes, row bands and confidence numbers on `answer-canvas` | P1 |

### 5.5 Micro-interactions
| ID | Requirement | Pri |
|---|---|---|
| FR-33 | Synthesised pen-scratch sound (WebAudio, volume follows speed), soft "tick" when an answer lands; global mute, default off or low | P1 |
| FR-34 | Haptic tick via `navigator.vibrate` where supported (feature-detected) | P1 |
| FR-35 | Toolbar buttons have press feedback and tooltips; active tool highlighted | P1 |
| FR-36 | Shortcuts: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`, `B` pen, `E` eraser, `[` / `]` width, `Del` clear (undoable) | P1 |

### 5.6 Persistence and export
| ID | Requirement | Pri |
|---|---|---|
| FR-37 | Autosave strokes (debounced, `requestIdleCallback`) to IndexedDB; restore on load; versioned schema (`v: 1`) | P1 |
| FR-38 | "New page" clears and starts a fresh autosave slot | P1 |
| FR-39 | Export PNG (paper + ink + answers composited from the layers at device resolution) and SVG (vector ink + answers as text; "include paper" toggle) | P1 |
| FR-40 | Quota / storage errors are caught and shown as a quiet toast, never a crash | P1 |

---

## 6. Non-functional requirements

| ID | Requirement | Verified by |
|---|---|---|
| NFR-1 | **60 FPS** while drawing, including while recognition runs; no main-thread long task (> 50 ms) during drawing | DevTools Performance trace; FPS meter (`?debug`) |
| NFR-2 | Pointer sample → pixel within the same frame (rAF-batched; `desynchronized: true` hint on the live context where supported) | Visual check; trace |
| NFR-3 | **Memory stable** over prolonged use: no monotonic heap growth over a scripted 10-minute draw / erase / undo loop; history capped; caches weak | Heap snapshot comparison; soak script |
| NFR-4 | **Fully offline** after first load: fonts, sounds, textures, icons all bundled; zero third-party requests | DevTools offline + airplane mode; Network panel |
| NFR-5 | Crisp at DPR 1, 1.5, 2, 3 and after a DPR change | Manual matrix + coordinate tests |
| NFR-6 | This part adds ≲ 50 KB gzip (excluding ML model and fonts) | `vite build` report |
| NFR-7 | No unhandled exceptions from any input sequence (multi-touch, rapid tool switching, resize mid-stroke) | Unit tests + manual fuzz |
| NFR-8 | Keyboard operable toolbar, visible focus, sufficient contrast on every paper theme | Manual a11y pass |

---

## 7. Technical design

### 7.1 Library decision
**Build our own thin canvas layer; use `perfect-freehand` for ink smoothing.**

| Option | Verdict | Reason |
|---|---|---|
| Excalidraw / tldraw / draw.io | Rejected | Whole whiteboard apps with their own scene, state and UI. We'd fight them for raw stroke data and 60 FPS control; large bundles; most features unused. tldraw's SDK licence is not plain MIT: check before relying on it |
| Konva / Fabric.js | Rejected | Scene graphs for objects, not thousands of freehand points; still need custom erasers and answer anchoring |
| `szimek/signature_pad` | Borrow ideas only | Great smooth ink and export, but owns its canvas and data model, which conflicts with our `StrokeStore` |
| **`perfect-freehand` (MIT)** | **Adopt** | Pure function from points (+ pressure) to a smooth outline; plugs into our own store and renderer |

### 7.2 Layers
```
.page (position: relative; fixed logical size)
├── paper          CSS background + generated texture (themeable; also used by export)
├── stroke-canvas  committed ink (cached Path2D per stroke)
├── live-canvas    in-progress stroke only; receives pointer events
├── answer-canvas  answers, confidence dots, reading/stale states, debug overlay; pointer-events: none
└── .sr-only       hidden aria-live text mirroring the answers
```
Why a separate answer layer: ink never has to be repainted when an answer fades; the answer layer is small and redraws only for ~300 ms transitions; export composites layers with `drawImage`; the text is literally drawn on the canvas surface as the PS asks.

### 7.3 Rendering pipeline
1. `pointermove` → push coalesced samples into the live stroke → schedule **one** `requestAnimationFrame`.
2. rAF: clear live canvas, regenerate the outline of the live stroke only, fill it.
3. `pointerup`: commit to `StrokeStore`; draw **only the new stroke** onto `stroke-canvas`; clear live canvas.
4. Full redraw only on undo / redo / erase / clear / resize / theme change, using the `WeakMap<Stroke, Path2D>` cache. Erasing creates new immutable strokes, so stale cache entries are never reused and get collected.
5. React never re-renders per point; handlers use refs.

```ts
import { getStroke } from 'perfect-freehand';
const cache = new WeakMap<Stroke, Path2D>();
export function strokePath(s: Stroke): Path2D {
  let p = cache.get(s);
  if (p) return p;
  const outline = getStroke(s.points.map(pt => [pt.x, pt.y, pt.pressure]), {
    size: s.width * 2, thinning: 0.6, smoothing: 0.5, streamline: 0.5,
    simulatePressure: s.pointerType !== 'pen',
  });
  p = new Path2D(outlineToSvgPath(outline)); // midpoint quadratic path, as in the library README
  cache.set(s, p);
  return p;
}
```

### 7.4 Recognition trigger and stale-result protection
- `StrokeStore.version` increases on every change; it also reports the ids of changed strokes.
- After pen-up, wait ~500 ms. If nothing changed, send the data to the recognition side. New input cancels the wait.
- Results come back tagged with the `version` they were computed for. If `store.version` has moved on and the changed strokes touch that row, the result is shown as stale or dropped; it never overwrites newer drawing.
- Recognition input is rasterised from **raw points at a fixed width and colour**, never from the pretty ink.

### 7.5 Rows and answer placement
- Row detection is **recognition's job**: group strokes into symbols first (so `=` and `÷` are single boxes), then cluster symbols into rows by vertical overlap (the reference doc's §11 describes this).
- The canvas receives, per row, the symbol groups with their **stroke ids**. It computes the bounding box of the row's last `=` from those strokes, so all geometry stays in one coordinate system.
- Placement: x = right edge of the `=` box + gap; y = box centre; font size ≈ 0.8 × median symbol height in that row; clamp to the page; collision rule per FR-24.
- Ruled paper spacing gives users a natural row height, which also helps row detection.

### 7.6 Data model
```ts
interface Point { x: number; y: number; pressure: number; t: number }
interface Stroke {
  id: string; points: Point[]; width: number; color: string;
  pointerType: 'pen' | 'mouse' | 'touch';
}
type StrokeAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokes: Stroke[] }
  | { type: 'replace'; before: Stroke[]; after: Stroke[] }   // pixel eraser: no full snapshot
  | { type: 'clear'; strokes: Stroke[] };

interface RowResult {                       // one per recognised row
  rowId: string;
  version: number;                          // store version it was computed for
  symbols: { label: string; confidence: number; strokeIds: string[]; candidates?: { label: string; p: number }[] }[];
  expression: string;                       // e.g. "18+4*3"
  evaluation:
    | { ok: true; value: number; steps?: string[] }
    | { ok: false; error: 'DIV_ZERO' | 'SYNTAX' | 'NO_EQUALS' };
}

interface AnswerMark {                      // what the answer layer draws
  rowId: string;
  anchor: { x: number; y: number; w: number; h: number };  // bbox of the row's last '='
  text: string;
  status: 'ok' | 'stale' | 'undefined' | 'error' | 'reading';
}
```
Contract owners: canvas owns `Stroke`, `StrokeAction`, `AnswerMark`; recognition / parser own `RowResult`. The shared `src/contract.ts` is changed only with both sides aware.

### 7.7 Module ownership (proposed)
| Canvas owner | Recognition / parser owners |
|---|---|
| `src/canvas/*` (store, renderers, input, paper, export, persistence) | `src/recognition/*` |
| `src/overlay/*` (answer layer, debug overlay), `src/components/*`, `src/styles/*`, `src/audio/*` | `src/workers/*` |
| tests for the above | `src/parser/*` and their tests |

Shared: `src/contract.ts`, `src/App.tsx` wiring.

### 7.8 Differences from the reference architecture
Same skeleton: framework-agnostic stroke store, stacked canvas layers, Pointer Events, answers drawn on a canvas layer, row detection planned in recognition. Recommended changes:
1. **Fonts:** self-host (`@fontsource`), because Google Fonts breaks offline.
2. **Pixel eraser:** `replace {before, after}` undo instead of full-canvas snapshots.
3. **Rendering:** draw only the new stroke on commit; `Path2D` cache; no full redraw per store change.
4. **Dedicated `answer-canvas`** so ink is never repainted for answer animations.
5. **Version-tagged recognition results** to discard stale output.
6. **Remove the legacy ~86 MB ONNX files** from the repo and build.
7. **Fixed page now; scrolling later** via a `scrollY` world transform. Never allocate an ever-growing canvas.
8. **Bundle only the latin font subsets.**

### 7.9 Ideas worth the time
- Ruled paper by default (better row discipline, looks good).
- `?debug` overlay for the team and for demos.
- Record real stroke samples (JSON) as test fixtures for the store, eraser and recognition.
- Per-row dirty tracking: the store reports changed stroke ids, so only the affected row is re-recognised.

---

## 8. Libraries

| Library | Use | Licence | Status |
|---|---|---|---|
| `perfect-freehand` | Smooth pressure-aware ink outlines | MIT | Adopt |
| `idb-keyval` | Tiny IndexedDB wrapper for autosave | Apache-2.0 | Adopt (or raw IndexedDB) |
| `@fontsource/inter`, `@fontsource/caveat` | Offline fonts | OFL via packages | Adopt (latin subsets) |
| `vitest` + `jsdom` | Unit tests | MIT | In place |
| `@playwright/test` | 2–3 e2e smoke tests (draw, offline, export) | Apache-2.0 | Optional (P2) |

Re-check each licence before submission and list them in the README attribution section.

---

## 9. Test plan

**Unit (Vitest)**
- `eventToPageCoords`: offsets, DPR 1 / 1.5 / 2 / 3, transformed containers
- `StrokeStore`: add / undo / redo / clear, 100-step cap, redo cleared on new action, stroke eraser, pixel eraser split + `replace` undo, version counter, changed-id reporting, subscribers
- Path cache: reuse for unchanged strokes, new path after erase
- **Answer placement:** right of `=`, vertical centring, per-row independence, collision nudge / shrink, clamp to page, new row doesn't change older rows
- **Stale handling:** results with an old `version` don't overwrite newer state
- Scratch detector: scribble fixtures trigger; `=`, `8`, `x`, `+` fixtures do not
- Export: SVG snapshot; PNG dimensions = CSS size × DPR
- Persistence: round trip, schema version check, quota error handling

**Manual matrix:** Chrome / Edge / Firefox / Safari; mouse, touch, stylus; DPR 1 / 2; light / dark paper; airplane mode.

**Performance:** DevTools trace while drawing during recognition; 10-minute heap soak; `vite build` size report. Keep screenshots for the README.

---

## 10. Delivery plan (1–7 Oct 2026)

| Day | Target |
|---|---|
| **Thu 1 Oct** | Scaffold PR (docs v2, contract draft). Merge after teammates review. Start P0 canvas |
| **Fri 2 Oct** | P0 canvas merged: pen, undo/redo, both erasers, clear, width, DPR, coordinate + store tests. Ink engine (`perfect-freehand`) |
| **Sat 3 Oct** | Paper themes (ruled), toolbar, offline fonts, answer layer with per-row placement and stale / undefined / reading states |
| **Sun 4 Oct** | Integrate teammates' latest pipeline and rows; autosave, export, shortcuts, sound + haptics |
| **Mon 5 Oct** | Confidence dots, debug overlay, scratch-to-erase (P2), profiling, memory soak, offline run-through |
| **Tue 6 Oct** | **Feature freeze.** README sections, GIF + screenshots, deploy, final QA on mouse + tablet |
| **Wed 7 Oct** | Submit early; buffer only |

If something slips, cut from the bottom of P2 upward. Never cut tests, offline correctness or the README.

### Git workflow
- One branch per task (`feat/canvas-p0`, `feat/answer-layer`, `fix/...`), merged by pull request; teammate reviews; use "Merge pull request", not squash, so individual commits stay visible.
- Conventional commits (`feat(canvas): …`, `fix(store): …`, `test(coords): …`, `docs: …`). Small commits, steady rhythm.
- PR template: What / Why / How tested / Screenshot or GIF.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Judges use a mouse, not a stylus | Mouse is first-class; pressure simulated |
| No stylus hardware to test on | Feature-detect everything; keep fallbacks; test on any touch / pen device available |
| Row detection splits or merges rows wrongly | Ruled paper guides spacing; debug overlay shows row bands; fixtures from real handwriting; recognition owns the algorithm |
| Answer collides with ink or the next row | FR-24 collision rule + tests |
| Scratch-to-erase triggers while writing | ≥ 4 direction reversals, high path-length / bbox ratio, short duration, overlap with ink; negative fixtures; P2, can ship disabled |
| Fancy ink hurts frame rate | Only the live stroke is regenerated per frame; committed ink is cached; profile before adding polish |
| Fonts not ready when text is drawn | Await `document.fonts.load()` before first answer draw |
| Stale recognition overwrites newer input | Version tag + discard rule |
| Autosave quota / corruption | Versioned schema, try/catch, fall back to memory |
| Scope creep | P0 → P1 → P2 order is binding; cut line on 5 Oct |

---

## 12. Definition of done

- [ ] All P0 requirements pass; P1 items done or consciously cut and listed in the README
- [ ] Unit tests green in CI; coverage on store, coordinates, answer placement, export, persistence
- [ ] 60 FPS trace captured with recognition running; no long tasks while drawing
- [ ] Offline verified (airplane mode, zero external requests); fonts self-hosted
- [ ] 10-minute soak shows no heap growth trend
- [ ] README has canvas architecture, library justification (with rejected alternatives), setup (`npm install && npm run dev`), attribution and licences
- [ ] Public deployment link works on desktop and tablet
- [ ] Balanced commit history; every PR reviewed

---

## 13. Open questions
1. Does recognition's row detection output stroke ids per symbol and a stable `rowId`? (Needed for FR-21 and FR-31.)
2. Is the scrollable notes page in scope for this submission, or post-submission?
3. Who owns `App.tsx` wiring day to day?
4. Which deploy target (Vercel / Netlify / GitHub Pages), and who sets it up?
5. Does recognition expose top-k candidates so tap-to-correct is possible?
