# CalcInk: Canvas, Ink & UX — Product Requirements Document

| | |
|---|---|
| **Owner** | Canvas / UI-UX / live result projection |
| **Project** | Inter IIT Bootcamp, Software PS: CalcInk (100% client-side) |
| **Status** | Draft v1, 1 Oct 2026 |
| **Submission deadline** | 7 Oct 2026 (internal feature freeze: 6 Oct) |
| **Related docs** | PS PDF (source of truth), `calcink_architecture.md` (teammate's reference architecture, adaptable) |

---

## 1. Purpose

Deliver the part of CalcInk the user actually touches: a fast, beautiful, stylus-first digital-paper canvas on which handwritten math is written, edited and erased, and on which the computed answer appears inline, next to the `=` sign, and updates live when the equation is edited.

Recognition (model, symbol grouping, worker) and the arithmetic parser belong to the teammate's part. This PRD covers everything from **pointer input to pixels on screen**, plus the **projection of results back onto the canvas**.

### 1.1 Goals
1. Satisfy every canvas-related *required* feature in the PS, with tests.
2. Hold 60 FPS and zero perceptible pen lag while recognition runs.
3. Maximise the **Creativity & UX (20 pts)** score with a small number of polished, cheap-to-build extras.
4. Contribute clearly to **Performance (20 pts)**, **Architecture doc (20 pts)** and **Teamwork (15 pts)**.

### 1.2 Non-goals
- No backend, accounts, sync or collaboration (storage is local only).
- No whiteboard features: shapes, text boxes, images, layers, infinite zoom.
- No ML work, no change to the recognition model.
- Not a general drawing app. Only pen/stylus-style ink is supported.

---

## 2. Rubric mapping (what this part earns)

| Rubric pillar (PS) | Points | How this part contributes |
|---|---|---|
| Feature implementation & test suites | 25 | All required canvas features (smooth drawing, undo/redo, stroke + pixel eraser, clear, width, DPR); unit tests for coordinate conversion, store, eraser, export |
| Idea & architecture document | 20 | Canvas/ink section of README: layer design, data model, rendering pipeline, library justification, rejected alternatives |
| Performance & runtime | 20 | rAF-batched input, cached `Path2D` per stroke, layered canvases, no main-thread work during drawing, memory-stable undo, offline verified |
| Teamwork & engineering | 15 | Folder ownership, feature branches, small PRs, conventional commits |
| Creativity & UX | 20 | Paper aesthetic, pressure-aware ink, animated answer, stylus niceties, sound/haptics, scratch-to-erase, export |

---

## 3. Users & demo scenarios

- **Student / judge with a mouse**: must work flawlessly (assume judges will not have a stylus).
- **Tablet / stylus user**: gets the premium path (pressure, tilt-free, eraser end, palm rejection).
- **Demo script (90 s)**: write `18+4×3=` → answer appears with a soft animation → erase the `3`, write `5` → answer updates (old answer dims, new one cross-fades) → write `5÷0=` → clean "Undefined" → scratch out a term → switch paper → undo/redo → export PNG → toggle airplane mode and repeat.

---

## 4. Scope and priorities

**P0: required baseline (must ship first)**
- Ink canvas with mouse / touch / pen via Pointer Events
- Undo / redo, stroke eraser, pixel eraser, clear, stroke-width control
- High-DPI crispness (`devicePixelRatio`)
- Inline answer next to `=`, live re-evaluation on edit
- Unit tests, 60 FPS, offline

**P1: high value, low cost (target all)**
- Pressure / velocity-aware smooth ink (`perfect-freehand`)
- Paper themes (plain / grid / dot / ruled) with a generated paper texture
- Ink colour swatches and width presets
- Animated answer reveal, stale/loading/error states
- Stylus niceties: eraser end, hover cursor, palm rejection
- Export PNG + SVG
- Autosave to IndexedDB
- Self-hosted fonts (offline-safe)
- Sound + haptic feedback (toggleable)
- Keyboard shortcuts
- Dev FPS meter

**P2: stretch (only if P0/P1 are done and stable)**
- Scratch-to-erase gesture
- "Show steps" overlay (BODMAS reduction chain)
- Tap-a-symbol to correct recognition (needs top-k from recognition)
- Notes mode: scrollable page (see teammate doc §11)
- Variable memory (`x = 10`) and 2D plotting (depends on recognition vocabulary; coordinate with teammate)

---

## 5. Functional requirements

### 5.1 Ink canvas and input
| ID | Requirement | Pri |
|---|---|---|
| FR-1 | Draw with mouse, touch and stylus through Pointer Events with `setPointerCapture`; canvas has `touch-action: none` | P0 |
| FR-2 | Capture `pressure` and use `getCoalescedEvents()` (when available) so fast strokes keep all samples | P1 |
| FR-3 | Strokes render smoothly (no polyline corners) while drawing and after commit; live and committed look identical (no visual "pop" on pen lift) | P0 |
| FR-4 | With a mouse (constant pressure) fall back to simulated pressure from velocity so the ink still looks natural | P1 |
| FR-5 | Palm rejection: once a `pen` pointer has been seen, ignore `touch` pointers for drawing; mouse always allowed | P1 |
| FR-6 | Pen eraser end / barrel button (`buttons & 32`) temporarily switches to stroke eraser | P1 |
| FR-7 | Hover (pen / mouse with no buttons down) shows a brush-size cursor ring | P1 |
| FR-8 | Canvas resizes with the window and re-rasterises crisply; DPR changes (window moved between monitors, browser zoom) are detected and handled | P0 |
| FR-9 | All coordinates stored in CSS pixels in page space; one tested function converts client coords to canvas coords | P0 |

### 5.2 Tools and history
| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Tools: pen, stroke eraser, pixel eraser (radius adjustable) | P0 |
| FR-11 | Undo / redo (capped at 100 steps), clear canvas (undoable) | P0 |
| FR-12 | Width control: slider plus 3 presets (fine / medium / bold) | P0 / P1 |
| FR-13 | Ink colour: 4–5 swatches. Colour and width must **never** change recognition output (recognition rasterises from point data in a fixed colour and width) | P1 |
| FR-14 | Pixel eraser undo stores only the strokes it changed (before/after), not a full-canvas snapshot | P1 |
| FR-15 | Scratch-to-erase: a fast zig-zag scribble over existing ink deletes the strokes it covers as one undoable action; a normal symbol never triggers it | P2 |

### 5.3 Paper and visual design
| ID | Requirement | Pri |
|---|---|---|
| FR-16 | Paper surface with subtle texture and soft vignette, generated in code (no network assets) | P1 |
| FR-17 | Paper themes: plain, grid, dot, ruled, plus a dark "chalkboard" mode | P1 |
| FR-18 | Typography: UI in Inter, answers in Caveat (both self-hosted via npm font packages); canvas text only drawn after `document.fonts.load()` resolves | P1 |
| FR-19 | Responsive layout: toolbar docks to the side on desktop and the bottom on tablets/phones; touch targets ≥ 44 px | P1 |
| FR-20 | Respect `prefers-reduced-motion` and `prefers-color-scheme` | P1 |

### 5.4 Result projection and reactive editing
| ID | Requirement | Pri |
|---|---|---|
| FR-21 | Answer is shown immediately right of the last `=` symbol, vertically centred on it, with font size scaled to the height of the written symbols | P0 |
| FR-22 | When the equation changes, answer re-evaluates and updates in place; the previous answer dims (stale state) until the new one arrives, then cross-fades. No flicker or blank gap | P0 / P1 |
| FR-23 | Error states: division by zero shows **Undefined**; syntax errors / unreadable input show a muted "?" with no exception thrown | P0 |
| FR-24 | If the answer would overlap existing ink to the right, nudge it into free space (and never off-screen) | P1 |
| FR-25 | Subtle "reading…" indicator (pulsing dot beside `=`) while the worker is running | P1 |
| FR-26 | Per-symbol confidence indicators (green / amber / red dot), toggleable | P1 |
| FR-27 | Tap an answer to copy it; "Show steps" expands the BODMAS reduction chain (e.g. `18 + 4×3 → 18 + 12 → 30`) | P2 |
| FR-28 | Answers are DOM elements in a `pointer-events: none` overlay with `aria-live="polite"`, animated with CSS transform/opacity (compositor-only) | P1 |

### 5.5 Micro-interactions
| ID | Requirement | Pri |
|---|---|---|
| FR-29 | Synthesised pen-scratch sound (WebAudio, volume follows stroke speed), soft "tick" when an answer lands; global mute toggle, default **off** or low | P1 |
| FR-30 | Haptic tick via `navigator.vibrate` where supported (feature-detected, no-op elsewhere) | P1 |
| FR-31 | Toolbar buttons have press feedback and tooltips; active tool is clearly highlighted | P1 |
| FR-32 | Shortcuts: `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z` / `Ctrl+Y`, `B` pen, `E` eraser, `[` / `]` width, `Del` clear (with undo) | P1 |

### 5.6 Persistence and export
| ID | Requirement | Pri |
|---|---|---|
| FR-33 | Autosave strokes (debounced, via `requestIdleCallback`) to IndexedDB; restore on load; versioned schema (`v: 1`) | P1 |
| FR-34 | "New page" clears and starts a fresh autosave slot | P1 |
| FR-35 | Export PNG (paper + ink + answers, at device resolution) and SVG (vector ink + answers as text; "include paper" toggle) | P1 |
| FR-36 | Quota or storage errors are caught and surfaced as a quiet toast, never a crash | P1 |

---

## 6. Non-functional requirements

| ID | Requirement | How it is verified |
|---|---|---|
| NFR-1 | **60 FPS** while drawing, including while recognition is running; no main-thread long task (> 50 ms) during drawing | Chrome DevTools Performance trace; dev FPS meter (`?debug`) |
| NFR-2 | Pointer sample → pixel within the same frame (rAF-batched; `desynchronized: true` hint on the live context where supported) | Visual check at high speed; trace |
| NFR-3 | **Memory stable** over a prolonged session: no monotonic heap growth over a scripted 10-minute drawing / erasing / undo loop; history capped; caches keyed weakly | Heap snapshot comparison; soak script |
| NFR-4 | **Fully offline** after first load: fonts, sounds, textures, icons all bundled; zero third-party requests | DevTools Network offline + airplane mode; Network panel shows 0 external requests |
| NFR-5 | Crisp at DPR 1, 1.5, 2, 3 and after DPR change | Manual matrix + coordinate tests |
| NFR-6 | My part adds ≲ 50 KB gzip to the bundle (excluding the ML model) | `vite build` report |
| NFR-7 | No unhandled exceptions from any input sequence (including multi-touch, rapid tool switching, resizing mid-stroke) | Unit tests + manual fuzz |
| NFR-8 | Keyboard operable toolbar, visible focus, sufficient contrast on every paper theme | Manual a11y pass |

---

## 7. Technical design

### 7.1 Decision: custom canvas layer + small ink library

**Build our own thin canvas layer. Do not adopt Excalidraw, tldraw, draw.io, Konva or Fabric.js.**

| Option | Verdict | Reason |
|---|---|---|
| Excalidraw / tldraw / draw.io | Rejected | Full whiteboard apps with their own scene graph, state, UI and (React) runtime. We would fight them for raw stroke data, worker-friendly rasterisation and 60 FPS control; large bundles; most of their features (shapes, text, layers, collaboration) are not needed. tldraw's SDK licence is not plain MIT, so check terms before relying on it. |
| Konva / Fabric.js | Rejected | Retained-mode scene graphs built for objects, not thousands of freehand points. Added overhead, no benefit for pen ink, still need custom eraser / answer-anchoring logic. |
| `szimek/signature_pad` (the screenshot demo) | Borrow ideas only | Great velocity-based smooth ink and export APIs, but it owns its canvas and data model, which conflicts with our `StrokeStore` and layered design. |
| **`perfect-freehand` (MIT, tiny)** | **Adopt** | Turns a list of points (+ pressure) into a smooth variable-width outline. Pure function: no DOM, no state. Plugs straight into our own `StrokeStore` and renderer. |

The teammate's reference architecture already has the right skeleton: framework-agnostic `StrokeStore`, three stacked canvases, Pointer Events. We keep that and upgrade the renderer.

### 7.2 Layers
```
.page (position: relative)
├── paper        CSS background + generated texture (themeable, also used by export)
├── stroke-canvas  committed ink (cached Path2D per stroke)
├── live-canvas    in-progress stroke only; receives pointer events
└── overlay (DOM)  answer chips, confidence dots, hover cursor; pointer-events: none
```
Answers move from a canvas to **DOM elements** so CSS transitions run on the compositor, text stays crisp and selectable/copyable, and nothing on the main thread redraws per animation frame. Export composes them from data, not from the DOM.

### 7.3 Rendering pipeline
1. `pointermove` → push coalesced samples into the live stroke → schedule **one** `requestAnimationFrame`.
2. rAF: clear live canvas, regenerate the outline of the single live stroke, fill it.
3. `pointerup`: commit to `StrokeStore`. Draw **only the new stroke** onto `stroke-canvas` (no full redraw). Clear live canvas.
4. Full redraw happens only on undo, redo, erase, clear, resize or theme change, using the `WeakMap<Stroke, Path2D>` cache. Erasing creates new immutable `Stroke` objects, so stale cache entries are never reused and get garbage collected.
5. React never re-renders per point; handlers use refs.

Recipe for the ink outline (from the library README):
```ts
import { getStroke } from 'perfect-freehand';

const cache = new WeakMap<Stroke, Path2D>();

export function strokePath(s: Stroke): Path2D {
  let p = cache.get(s);
  if (p) return p;
  const outline = getStroke(
    s.points.map(pt => [pt.x, pt.y, pt.pressure]),
    { size: s.width * 2, thinning: 0.6, smoothing: 0.5, streamline: 0.5,
      simulatePressure: s.pointerType !== 'pen' }
  );
  p = new Path2D(outlineToSvgPath(outline)); // quadratic-midpoint path, per README
  cache.set(s, p);
  return p;
}
```

### 7.4 Data model (additions to the teammate's model)
```ts
interface Point { x: number; y: number; pressure: number; t: number }
interface Stroke {
  id: string; points: Point[]; width: number; color: string;
  pointerType: 'pen' | 'mouse' | 'touch';
}
type StrokeAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokes: Stroke[] }
  | { type: 'replace'; before: Stroke[]; after: Stroke[] }   // pixel eraser, no full snapshot
  | { type: 'clear'; strokes: Stroke[] };

interface ResultMark {            // what the canvas needs to show an answer
  rowId: string;
  anchor: { x: number; y: number; w: number; h: number };  // bbox of the last '=' group
  text: string;
  status: 'ok' | 'stale' | 'undefined' | 'error' | 'reading';
}
```
Recognition must be independent of colour and width: rasterise symbols from point data in one fixed colour and a normalised stroke width.

### 7.5 Module ownership (to avoid merge conflicts)
| Mine | Teammate's |
|---|---|
| `src/canvas/*` (store, renderer, input, paper, export, persistence) | `src/recognition/*` |
| `src/overlay/*` (answer chips, dots, cursor) | `src/workers/*` |
| `src/components/*`, `src/styles/*`, `src/audio/*` | `src/parser/*` |
| `src/canvas/__tests__/*`, `src/overlay/__tests__/*` | `src/recognition/__tests__/*`, `src/parser/__tests__/*` |

Shared and change-controlled (both approve): `src/contract.ts` and `App.tsx` wiring.

### 7.6 Contract with recognition / parser
- **From me:** `store.subscribe`, `store.getStrokes()`, a `store.version` counter, a "dirty" hint (which stroke ids changed) for later incremental recognition.
- **To me:** `{ tokens, confidences, groups }` as in the reference doc, plus (requested) `candidates?: {label; p}[][]` for tap-to-correct, and `evaluate()` returning `{ ok: true; value } | { ok: false; error: 'DIV_ZERO' | 'SYNTAX' }` (and optionally the reduction steps).
- Recognition runs in the worker; **nothing in my part may do heavy synchronous work during `pointermove`.**

### 7.7 Changes I recommend to the reference architecture
1. **Fonts:** the doc lists Google Fonts; that breaks "complete offline". Use `@fontsource/inter` and `@fontsource/caveat`, and precache them with the PWA plugin.
2. **Pixel eraser:** replace the full-snapshot undo with `replace {before, after}`; this directly supports the "no memory leaks / stable memory" rubric line.
3. **Renderer:** incremental draw on commit and a `Path2D` cache instead of redrawing everything on each store change.
4. **Result drawing:** DOM overlay instead of repainting a canvas each time.
5. **Legacy ONNX files (~86 MB):** remove from the repo and build output (hurts clone/build time and the reproducibility rubric item).
6. **Canvas size in notes mode:** use viewport-sized canvases plus a `scrollY` world transform; never allocate an ever-growing canvas (memory = width × height × 4 × DPR²).

---

## 8. Libraries

| Library | Use | Licence | Status |
|---|---|---|---|
| `perfect-freehand` | Smooth pressure-aware ink outlines | MIT | Adopt |
| `idb-keyval` | Tiny IndexedDB wrapper for autosave | Apache-2.0 | Adopt (or raw IndexedDB) |
| `@fontsource/inter`, `@fontsource/caveat` | Offline fonts | OFL via packages | Adopt |
| `vitest` + `jsdom` | Unit tests | MIT | Already in stack |
| `@playwright/test` | 2–3 e2e smoke tests (draw, offline, export) | Apache-2.0 | Optional (P2) |

Check each licence once more before submitting, and list them in the README attribution section.

---

## 9. Test plan

**Unit (Vitest)**
- `eventToCanvasCoords`: offsets, scroll, DPR 1/1.5/2/3, CSS-transformed containers
- `StrokeStore`: add / undo / redo / clear, 100-step cap, redo cleared on new action, stroke eraser, pixel eraser split + `replace` undo, subscriber notification
- Path cache: reuse for unchanged strokes, new path after erase
- Scratch detector: scribble fixtures trigger; `=`, `8`, `x`, `+` fixtures do **not**
- Answer positioning: right of `=`, vertical centring, collision nudge, clamped to viewport
- Export: SVG string snapshot; PNG dimensions equal CSS size × DPR
- Persistence: serialise → deserialise round trip, schema version check, quota-error handling

**Manual matrix:** Chrome / Edge / Firefox / Safari; mouse, touch, stylus; DPR 1 / 2; light / dark paper; airplane mode.

**Performance:** DevTools trace while drawing during recognition; heap soak (10 min scripted loop); `vite build` size report. Save screenshots of the traces for the README.

---

## 10. Delivery plan (1–7 Oct 2026)

| Day | Target |
|---|---|
| **Thu 1 Oct** | Single shared repo, folder ownership, `contract.ts`, CI (lint + tests). **P0 canvas merged**: pen, undo/redo, both erasers, clear, width, DPR |
| **Fri 2 Oct** | Ink engine (`perfect-freehand`), rAF pipeline, coalesced events, pen/mouse handling, `StrokeStore` tests |
| **Sat 3 Oct** | Paper themes, toolbar UI, offline fonts, DOM answer overlay with stale / undefined / reading states |
| **Sun 4 Oct** | Integrate teammate's latest pipeline; autosave, export, shortcuts, sound + haptics |
| **Mon 5 Oct** | Scratch-to-erase (P2), polish, profiling, memory soak, offline run-through, fix list |
| **Tue 6 Oct** | **Feature freeze.** README / architecture sections, GIF + screenshots, deploy (Vercel / Netlify / GitHub Pages), final QA on mouse + tablet |
| **Wed 7 Oct** | Submit early; day is buffer only |

If something slips, cut from the bottom of P2 upward. Never cut tests, offline correctness or the README.

### Git workflow (for the Teamwork pillar)
- Branches: `feat/canvas-ink`, `feat/paper-themes`, `feat/answer-overlay`, `fix/...`.
- Conventional commits (`feat(canvas): …`, `fix(store): …`, `test(coords): …`, `docs: …`).
- Small PRs with a short template (what / why / how tested / screenshot or GIF); the other teammate reviews.
- Commit steadily and early so the history shows balanced contribution.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Judges test with a mouse, not a stylus | Mouse path is first-class; pressure is simulated from velocity |
| No stylus hardware to test on | Test on a touch / pen laptop or tablet; feature-detect everything; keep fallbacks |
| Scratch-to-erase triggers while writing symbols | Require ≥ 4 direction reversals, high path-length / bbox ratio, short duration **and** overlap with existing ink; add negative-fixture tests; it is P2 and can ship disabled |
| Fancy ink hurts frame rate | Only the live stroke is regenerated per frame; committed ink is cached; profile before adding polish |
| Fonts not ready when drawing / measuring text | Await `document.fonts.load()`; DOM text avoids most of the problem |
| iPad Safari quirks (gestures, Scribble) | `touch-action: none`, no text inputs in the draw area, test early if a device is available |
| Autosave quota or corruption | Versioned schema, try/catch, quiet fallback to in-memory |
| Scope creep | P0 → P1 → P2 order is binding; weekly cut line on 5 Oct |

---

## 12. Definition of done

- [ ] All P0 requirements pass; P1 items either done or consciously cut and listed in the README
- [ ] All unit tests green in CI; coverage on store, coords, export, persistence
- [ ] 60 FPS trace captured with recognition running; no long tasks while drawing
- [ ] Offline verified (airplane mode, 0 external requests); fonts self-hosted
- [ ] 10-minute soak shows no heap growth trend
- [ ] README has canvas architecture, library justification (with rejected alternatives), setup (`npm install && npm run dev`), attribution and licences
- [ ] Public deployment link works on desktop and tablet
- [ ] Balanced commit history; every PR reviewed

---

## 13. Open questions
1. Is the notes-mode scroll page (teammate doc §11) in scope for this submission, or a post-submission idea?
2. Who owns `App.tsx` wiring day to day?
3. Which deploy target (Vercel / Netlify / GitHub Pages) and who sets it up?
4. Does recognition expose top-k candidates so tap-to-correct is possible?
5. Is a third team member joining, and if so which area do they take (tests / docs / extras)?
