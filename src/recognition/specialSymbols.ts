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
    // Angle between 32° and 75° from horizontal, forward slash orientation (dx * dy < 0), mostly straight
    const angleDeg = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
    if (dx * dy < 0 && angleDeg >= 32 && angleDeg <= 75) {
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
    // 1. Taller than wide and predominantly vertical stroke:
    const isVertical = Math.abs(dy) > Math.abs(dx) * 1.1;
    // 2. Open shape (endpoints do not meet like '0', '6', or '8'):
    const isNonClosed = chordLen >= b.height * 0.65 && Math.abs(dy) >= b.height * 0.60;

    if (b.height >= b.width * 1.05 && isVertical && isNonClosed) {
      let leftBows = 0;
      let rightBows = 0;
      let maxSagitta = 0;

      for (const p of stroke.points) {
        const cross = (p.x - p0.x) * dy - (p.y - p0.y) * dx;
        const sag = Math.abs(cross / chordLen);
        if (sag > maxSagitta) maxSagitta = sag;

        // Determine bulge side relative to stroke orientation:
        // cross * Math.sign(dy) < 0 indicates bulging leftward '('
        // cross * Math.sign(dy) > 0 indicates bulging rightward ')'
        const side = cross * Math.sign(dy);
        if (side < -0.5) leftBows++;
        else if (side > 0.5) rightBows++;
      }

      // 3. Must have noticeable curvature (rejects straight '1'):
      const hasCurvature = maxSagitta >= chordLen * 0.05 && maxSagitta >= 2.5;

      // 4. Must bow predominantly in one direction (rejects 'S' or '3'):
      const totalBowed = leftBows + rightBows;
      if (hasCurvature && totalBowed > 0) {
        if (leftBows / totalBowed >= 0.70) return { token: '(', confidence: 0.95 };
        if (rightBows / totalBowed >= 0.70) return { token: ')', confidence: 0.95 };
      }
    }
  }

  return null;
}
