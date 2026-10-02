# CalcInk — Product Requirements Document

**Inter IIT Tech Meet 15.0 · Bootcamp Phase 1 · Software PS**
**Track:** Software Development · **Mode:** 100% client-side · **Team:** 1–3 · **Deadline:** 7 Oct

---

## 1. Outcome (What Success Looks Like)

A web notebook where a user **handwrites** an expression ending in `=` (e.g. `18+4×3 =`) and the **correct answer appears on the canvas next to the equals sign**, automatically. Editing the equation (erase/replace a digit) updates the answer live.

Everything runs **in the browser, offline, with zero cloud APIs**, and drawing stays **smooth at 60 FPS** even while recognition runs.

**Definition of done:**
- Write `18+4×3=` → `30` appears inline, hand-drawn-adjacent to `=`.
- Change `4` to `5` → answer updates to `33` without manual action.
- Works in airplane mode after first load.
- No stutter or stylus lag while recognizing.
- Live URL + public repo + README delivered.

---

## 2. Minimum Required Features

### F1. Digital Ink Canvas
- Draw with mouse, stylus, and touch (Pointer Events).
- Smooth curve rendering, low latency.
- Controls: **undo/redo, stroke eraser, pixel eraser, clear, stroke width**.
- High-DPI support via `window.devicePixelRatio`.

### F2. Handwriting Recognition
- Recognizes: digits `0–9`, `+ − × ÷`, `.`, and terminal `=`.
- Uses an **existing open-source pre-trained model** bundled in the client (no training from scratch).
- Runtime of choice: ONNX Runtime Web / TensorFlow.js / Transformers.js / WASM.

### F3. Math Evaluation Engine
- Deterministic parser (no `eval()`), BODMAS/PEMDAS precedence.
- Supports multi-digit integers, decimals, negative numbers.

### F4. Inline Result Projection + Reactive Editing
- Answer rendered on the canvas, adjacent to the `=` sign.
- Any edit (erase, replace, add stroke) triggers automatic re-evaluation and updates the answer.

---

## 3. Hard Constraints (Non-Negotiable)

| Constraint | Requirement |
|---|---|
| On-device only | Stroke capture, preprocessing, inference, and evaluation all in-browser. No Mathpix, OpenAI Vision, Google Vision, or custom servers. |
| Offline | Fully functional with no network once assets are loaded. |
| 60 FPS | Inference and image processing must **not** block the main thread (use Web Workers / OffscreenCanvas). |
| Safety | No unsanitized `eval()`. Division by zero shows `Undefined`. Malformed input never throws unhandled exceptions. |

---

## 4. Technical Approach (Suggested)

```
Pointer events → stroke store (x, y, t)
      ↓
Segment strokes into symbols (spatial grouping, left-to-right)
      ↓
Preprocess each symbol (crop, pad, resize → model tensor)   [Web Worker]
      ↓
Pre-trained model inference (ONNX/TF.js)                    [Web Worker]
      ↓
Token sequence  →  validate  →  parser  →  result
      ↓
Render result on canvas next to "="
```

- **Model choice:** small, fast, and accurate on digits + operators (e.g. an MNIST/CROHME-style or handwritten math symbol classifier from ONNX Model Zoo / Hugging Face / TF Hub). Document size, speed, accuracy, and alternatives considered.
- **Frontend:** any framework (React/Vue/Svelte/vanilla).
- **Offline:** service worker caching app shell + model file.
- **Debounce** recognition after pen-up to avoid redundant inference.

---

## 5. Deliverables

1. **Source repo** (GitHub/GitLab): modular, documented code.
2. **README.md** containing:
   - Quick start (`npm install && npm run dev`)
   - Architecture and pipeline description (strokes → tensors)
   - Model attribution: source link, license, architecture
   - Model justification (size, speed, accuracy, alternatives)
3. **Live demo** on Vercel / Netlify / Cloudflare Pages / GitHub Pages.
4. **Automated tests:** parser unit tests, division-by-zero and malformed-input edge cases, coordinate conversion tests.

---

## 6. Evaluation Rubric → Priorities

| Pillar | Points | What matters most |
|---|---|---|
| Feature Implementation & Tests | 25 | All canvas features, accurate recognition, correct BODMAS, test suite |
| Architecture & Design Doc | 20 | Clear README, model justification, stroke→tensor pipeline |
| Performance & Runtime | 20 | 60 FPS, worker-based inference, offline, no memory leaks |
| Teamwork & Engineering | 15 | Balanced commits, clean PRs, easy setup |
| Creativity & UX | 20 | Paper-like aesthetic, micro-interactions, extras |

---

## 7. Out of Scope for MVP (Optional Stretch)

Only after all required features are solid:
- Scratch-to-erase gesture
- Variable memory (`x = 10`)
- 2D function plotting
- Audio/haptic feedback, stroke animation, confidence indicators
- Paper-texture visuals

---

## 8. Acceptance Checklist

- [ ] Draw with mouse, stylus, touch; crisp on Retina displays
- [ ] Undo/redo, both erasers, clear, width control work
- [ ] Recognizes `0–9 + − × ÷ . =`
- [ ] Answer appears inline next to `=`
- [ ] Editing an equation updates the answer automatically
- [ ] BODMAS, decimals, negatives, multi-digit correct
- [ ] `5÷0=` → `Undefined`; garbage input doesn't crash
- [ ] No `eval()` anywhere
- [ ] Recognition runs off the main thread; no visible lag
- [ ] Works in airplane mode
- [ ] No memory growth in long sessions
- [ ] Tests passing
- [ ] README with model attribution and architecture
- [ ] Live deployment link works
