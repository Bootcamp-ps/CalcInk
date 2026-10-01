/**
 * answerRenderer.ts — Draws answers, confidence dots, reading/stale states
 * and the debug overlay onto the `answer-canvas` layer (PRD §7.2, D2, FR-21–32).
 *
 * Responsibilities (to be implemented):
 *  - Accept an array of `AnswerMark` objects and a `CanvasRenderingContext2D`
 *    for the dedicated `answer-canvas` (pointer-events: none).
 *  - For each mark, draw the answer text (Caveat font) immediately to the right
 *    of the anchor bbox with vertical centring; scale font to ≈ 0.8 × median
 *    symbol height (FR-21).
 *  - Animate opacity transitions for ok → stale → new-answer cross-fade;
 *    pulse a "reading…" dot while the worker is busy (FR-22, FR-25).
 *  - Render "Undefined" for DIV_ZERO and a muted "?" for SYNTAX / NO_EQUALS
 *    (FR-23).
 *  - Draw per-symbol confidence dots (green / amber / red) when enabled (FR-26).
 *  - Draw the `?debug` overlay (symbol boxes, row bands, confidence numbers)
 *    when the debug flag is set (FR-32).
 *  - Schedule `requestAnimationFrame` only while a transition is animating
 *    (≤ ~300 ms); remain idle otherwise (FR-29).
 *  - Await `document.fonts.load('1em Caveat')` before the first draw (PRD §11
 *    risk: fonts not ready).
 *  - Never touch the stroke-canvas or live-canvas.
 */

// TODO: implement answerRenderer (FR-21 – FR-32)
