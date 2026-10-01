/**
 * contract.ts — Shared types between canvas/overlay and recognition/parser.
 *
 * This file is change-controlled: both canvas and recognition owners must
 * approve edits.  Keep it minimal — only types and interfaces, no logic.
 *
 * Ownership (PRD §7.6):
 *   Canvas owns  → Point, Stroke, StrokeAction, AnswerMark
 *   Recognition / parser own → RowResult
 */

// ---------------------------------------------------------------------------
// Data model (PRD §7.6)
// ---------------------------------------------------------------------------

/** A single captured pointer sample in CSS-pixel page space. */
export interface Point {
  x: number;
  y: number;
  pressure: number;
  /** Timestamp (ms) from `performance.now()` or `Date.now()`. */
  t: number;
}

/** An immutable committed stroke. */
export interface Stroke {
  readonly id: string;
  readonly points: readonly Point[];
  readonly width: number;
  readonly color: string;
  readonly pointerType: 'pen' | 'mouse' | 'touch';
}

// ---------------------------------------------------------------------------
// Store actions (PRD §7.6)
// ---------------------------------------------------------------------------

export type StrokeAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokes: Stroke[]; indices?: readonly number[] }
  /** Pixel eraser: stores only changed strokes, not a full canvas snapshot. */
  | { type: 'replace'; before: Stroke[]; after: Stroke[] }
  | { type: 'clear'; strokes: Stroke[] };

// ---------------------------------------------------------------------------
// Recognition → Canvas (PRD §7.6)
// ---------------------------------------------------------------------------

/**
 * One recognised row result, returned by the recognition / parser pipeline.
 * Each result is tagged with the store `version` it was computed for so
 * stale results can be detected and discarded (PRD §7.4).
 */
export interface RowResult {
  /** Stable identifier for this row (assigned by recognition). */
  rowId: string;
  /** The `StrokeStore.version` at the time recognition was triggered. */
  version: number;
  /** Ordered list of recognised symbols in this row. */
  symbols: readonly {
    label: string;
    confidence: number;
    /** Ids of the strokes that form this symbol group. */
    strokeIds: readonly string[];
    /** Optional top-k candidates for tap-to-correct (P2). */
    candidates?: readonly { label: string; p: number }[];
  }[];
  /** Normalised expression string, e.g. `"18+4*3"`. */
  expression: string;
  /** Arithmetic evaluation result. */
  evaluation:
    | { ok: true; value: number; /** BODMAS reduction chain (P2). */ steps?: readonly string[] }
    | { ok: false; error: 'DIV_ZERO' | 'SYNTAX' | 'NO_EQUALS' };
}

// ---------------------------------------------------------------------------
// Canvas → Answer layer (PRD §7.6)
// ---------------------------------------------------------------------------

/**
 * Everything the answer-canvas renderer needs to draw one row's answer.
 * Derived by the canvas layer from a `RowResult`; the anchor bbox is
 * computed from the stroke ids of the row's last `=` symbol.
 */
export interface AnswerMark {
  /** Matches the originating `RowResult.rowId`. */
  rowId: string;
  /** Bounding box of the row's last `=` symbol, in CSS-pixel page space. */
  anchor: { x: number; y: number; w: number; h: number };
  /** Display text — a number, `"Undefined"`, or `"?"`. */
  text: string;
  status: 'ok' | 'stale' | 'undefined' | 'error' | 'reading';
}
