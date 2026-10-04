// @ts-nocheck
// ─── Special Symbol Detection ─────────────────────────────────────────
// Detects symbols with distinct geometric patterns (=, ÷, ., x, (, ))
// that are either missing from standard digit models or have unique
// multi-stroke signatures. Runs BEFORE the CNN so it takes priority.

import { Stroke, BoundingBox, getStrokeBounds } from '../canvas/strokeModel';
import { SymbolGroup } from './symbolGrouper';

export interface SpecialSymbolMatch {
  token: string;
  confidence: number;
}

/**
 * Return +1 if the stroke goes top-left→bottom-right (\),
 *        -1 if it goes top-right→bottom-left (/),
 *         0 if it is too horizontal/vertical/short to classify.
 */
function diagonalSign(stroke: Stroke): number {
  const p0 = stroke.points[0];
  const pn = stroke.points[stroke.points.length - 1];
  if (!p0 || !pn) return 0;
  const b = getStrokeBounds(stroke);
  if (!b || b.width < 5 || b.height < 5) return 0;
  const dxSign = pn.x - p0.x;
  const dySign = pn.y - p0.y;
  const product = dxSign * dySign;
  if (product > 0) return 1;  // \ diagonal
  if (product < 0) return -1; // / diagonal
  return 0;
}

/**
 * Check if a symbol group matches a known rule-based pattern.
 * Returns the token and confidence, or null if no match.
 */
export function detectSpecialSymbol(group: SymbolGroup): SpecialSymbolMatch | null {
  const { strokes } = group;

  // ─────────────────────────────────────────────────────────────────────
  // TWO-STROKE SYMBOLS
  // ─────────────────────────────────────────────────────────────────────
  if (strokes.length === 2) {
    const b1 = getStrokeBounds(strokes[0]);
    const b2 = getStrokeBounds(strokes[1]);
    if (!b1 || !b2) return null;

    // ── 'x': two crossing diagonal strokes ───────────────────────────
    // One goes \ (diagonalSign = +1), other goes / (diagonalSign = -1).
    // Their bounding boxes must overlap in both axes.
    const d1 = diagonalSign(strokes[0]);
    const d2 = diagonalSign(strokes[1]);
    if (d1 !== 0 && d2 !== 0 && d1 !== d2) {
      const xOverlap = Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x);
      const yOverlap = Math.min(b1.y + b1.height, b2.y + b2.height) - Math.max(b1.y, b2.y);
      const minDim = Math.min(b1.width, b1.height, b2.width, b2.height);
      if (xOverlap > minDim * 0.2 && yOverlap > minDim * 0.2) {
        return { token: 'x', confidence: 0.93 };
      }
    }

    // ── '=': two horizontal strokes stacked vertically ────────────────
    const isH1 = b1.width >= 6 && b1.width > Math.max(b1.height, 1) * 0.9;
    const isH2 = b2.width >= 6 && b2.width > Math.max(b2.height, 1) * 0.9;
    if (isH1 && isH2) {
      const c1y = b1.y + b1.height / 2;
      const c2y = b2.y + b2.height / 2;
      const verticalDist = Math.abs(c1y - c2y);
      const xOverlap = Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x);
      const minW = Math.min(b1.width, b2.width);
      const maxW = Math.max(b1.width, b2.width);
      if (
        xOverlap > 0.25 * minW &&
        minW / maxW > 0.30 &&
        verticalDist >= 2 &&
        verticalDist <= Math.max(60, maxW * 2.5)
      ) {
        return { token: '=', confidence: 0.99 };
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // THREE-STROKE SYMBOLS
  // ─────────────────────────────────────────────────────────────────────
  if (strokes.length === 3) {
    const boundsList = strokes
      .map(s => ({ stroke: s, bounds: getStrokeBounds(s) }))
      .filter((item): item is { stroke: Stroke; bounds: BoundingBox } => item.bounds !== null);

    if (boundsList.length === 3) {
      // ── '÷': horizontal bar + dot above + dot below ─────────────────
      boundsList.sort((a, b) => b.bounds.width - a.bounds.width);
      const bar = boundsList[0].bounds;
      const dot1 = boundsList[1].bounds;
      const dot2 = boundsList[2].bounds;

      const isBar = bar.width >= 10 && bar.width > Math.max(bar.height, 1) * 1.3;
      const isDot1 = dot1.width <= bar.width * 0.7 && dot1.height <= bar.width * 0.7;
      const isDot2 = dot2.width <= bar.width * 0.7 && dot2.height <= bar.width * 0.7;

      if (isBar && isDot1 && isDot2) {
        const barMidY = bar.y + bar.height / 2;
        const d1MidY = dot1.y + dot1.height / 2;
        const d2MidY = dot2.y + dot2.height / 2;
        const oneAbove = (d1MidY < barMidY && d2MidY > barMidY) || (d2MidY < barMidY && d1MidY > barMidY);
        if (oneAbove) {
          return { token: '÷', confidence: 0.99 };
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // SINGLE-STROKE SYMBOLS
  // ─────────────────────────────────────────────────────────────────────
  if (strokes.length === 1) {
    const stroke = strokes[0];
    const b = getStrokeBounds(stroke);
    if (!b) return null;

    // ── '.' decimal point: tiny blob ─────────────────────────────────
    if (b.width <= 15 && b.height <= 15 && stroke.points.length <= 10) {
      return { token: '.', confidence: 0.96 };
    }

    // Need enough points for shape analysis
    if (stroke.points.length < 5) return null;

    const p0 = stroke.points[0];
    const pn = stroke.points[stroke.points.length - 1];
    const dx = pn.x - p0.x;
    const dy = pn.y - p0.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);

    // Too short to classify safely — pass to CNN
    if (chordLen < 15) return null;

    // ── '/' slash (→ division) ────────────────────────────────────────
    // Tall (height > 1.5× width), mostly straight, / direction only
    if (b.height > b.width * 1.5 && dx * dy < 0) {
      let maxDev = 0;
      let sumDev = 0;
      for (const p of stroke.points) {
        const dev = Math.abs((p.x - p0.x) * dy - (p.y - p0.y) * dx) / chordLen;
        if (dev > maxDev) maxDev = dev;
        sumDev += dev;
      }
      const avgDev = sumDev / stroke.points.length;
      // Straight lines: small deviation relative to chord length
      if (maxDev < chordLen * 0.12 && avgDev < chordLen * 0.06) {
        return { token: '÷', confidence: 0.95 };
      }
    }

    // ── '(' and ')' brackets ─────────────────────────────────────────
    // Must be tall (height > 1.5× width) AND mostly vertical chord (not diagonal)
    const chordDiag = Math.abs(dx) / (Math.abs(dy) + 1e-6);
    if (b.height > b.width * 1.5 && chordDiag < 0.5) {
      let leftBows = 0, rightBows = 0, maxSagitta = 0;
      for (const p of stroke.points) {
        const cross = (p.x - p0.x) * dy - (p.y - p0.y) * dx;
        const sag = Math.abs(cross / chordLen);
        if (sag > maxSagitta) maxSagitta = sag;
        if (cross * dy < 0) leftBows++;
        else if (cross * dy > 0) rightBows++;
      }

      // Reject any shape that dips back towards centre in the middle 50% span
      let minMiddle = Infinity;
      for (const p of stroke.points) {
        const proj = ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / (chordLen * chordLen);
        if (proj >= 0.25 && proj <= 0.75) {
          const cross = (p.x - p0.x) * dy - (p.y - p0.y) * dx;
          const sag = Math.abs(cross / chordLen);
          if (sag < minMiddle) minMiddle = sag;
        }
      }

      const n = stroke.points.length;
      if (maxSagitta > chordLen * 0.08 && maxSagitta > 2 && minMiddle > maxSagitta * 0.4) {
        if (leftBows > n * 0.8) return { token: '(', confidence: 0.95 };
        if (rightBows > n * 0.8) return { token: ')', confidence: 0.95 };
      }
    }
  }

  return null;
}
