/**
 * contract.ts — Shared types between canvas/overlay and recognition/parser.
 *
 * This file is change-controlled: both canvas and recognition owners must
 * approve edits.  Keep it minimal — only types and interfaces, no logic.
 */

// ---------------------------------------------------------------------------
// Data model (PRD §7.4)
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

/** Axis-aligned bounding box. */
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ---------------------------------------------------------------------------
// Store actions (PRD §7.4)
// ---------------------------------------------------------------------------

export type StrokeAction =
  | { type: 'add'; stroke: Stroke }
  | { type: 'remove'; strokes: Stroke[] }
  | { type: 'replace'; before: Stroke[]; after: Stroke[] }
  | { type: 'clear'; strokes: Stroke[] };

// ---------------------------------------------------------------------------
// Recognition → Canvas (PRD §7.6)
// ---------------------------------------------------------------------------

/** A single recognised symbol with spatial information. */
export interface RecognizedSymbol {
  label: string;
  confidence: number;
  /** Bounding box of the symbol group in CSS pixels. */
  bbox: BBox;
  /** Stroke ids that form this symbol. */
  strokeIds: readonly string[];
  /** Optional top-k candidates for tap-to-correct (P2). */
  candidates?: readonly { label: string; p: number }[];
}

/** Full result returned by the recognition pipeline. */
export interface RecognitionResult {
  symbols: readonly RecognizedSymbol[];
}

// ---------------------------------------------------------------------------
// Parser → Canvas (PRD §7.6)
// ---------------------------------------------------------------------------

export type EvalResult =
  | { ok: true; value: number; /** Optional BODMAS reduction steps. */ steps?: readonly string[] }
  | { ok: false; error: 'DIV_ZERO' | 'SYNTAX' };

// ---------------------------------------------------------------------------
// Result mark — what the overlay needs to render an answer (PRD §7.4)
// ---------------------------------------------------------------------------

export interface ResultMark {
  /** Unique id for the expression row. */
  rowId: string;
  /** Bounding box of the last '=' symbol group. */
  anchor: BBox;
  /** Display text (number or "Undefined" / "?"). */
  text: string;
  status: 'ok' | 'stale' | 'undefined' | 'error' | 'reading';
}
