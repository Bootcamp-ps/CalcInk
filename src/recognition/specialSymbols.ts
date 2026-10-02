// ─── Special Symbol Detection ─────────────────────────────────────────
// Detects symbols with distinct geometric patterns (=, ÷, .) that are
// either missing from standard digit models or have unique multi-stroke signatures.

import { Stroke, BoundingBox, getStrokeBounds } from '../canvas/strokeModel';
import { SymbolGroup } from './symbolGrouper';

export interface SpecialSymbolMatch {
  token: string;
  confidence: number;
}

/**
 * Check if a symbol group matches a known rule-based pattern:
 * - "=": Two parallel horizontal strokes vertically stacked
 * - "÷": Horizontal bar with a dot above and a dot below
 * - ".": Single small dot stroke
 */
export function detectSpecialSymbol(group: SymbolGroup): SpecialSymbolMatch | null {
  const { strokes } = group;

  // ─── 1. Equals Sign "=": exactly 2 horizontal strokes stacked vertically ───
  if (strokes.length === 2) {
    const b1 = getStrokeBounds(strokes[0]);
    const b2 = getStrokeBounds(strokes[1]);

    if (b1 && b2) {
      const isH1 = b1.width >= 8 && b1.width > Math.max(b1.height, 1) * 1.1;
      const isH2 = b2.width >= 8 && b2.width > Math.max(b2.height, 1) * 1.1;

      if (isH1 && isH2) {
        const c1y = b1.y + b1.height / 2;
        const c2y = b2.y + b2.height / 2;
        const verticalDist = Math.abs(c1y - c2y);

        const xOverlap = Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x);
        const minW = Math.min(b1.width, b2.width);
        const maxW = Math.max(b1.width, b2.width);

        if (
          xOverlap > 0.35 * minW &&
          minW / maxW > 0.35 &&
          verticalDist >= 3 &&
          verticalDist <= maxW * 2.5
        ) {
          return { token: '=', confidence: 0.99 };
        }
      }
    }
  }

  // ─── 2. Division Sign "÷": 3 strokes (bar + dot above + dot below) ───
  if (strokes.length === 3) {
    const boundsList = strokes
      .map(s => ({ stroke: s, bounds: getStrokeBounds(s) }))
      .filter((item): item is { stroke: Stroke; bounds: BoundingBox } => item.bounds !== null);

    if (boundsList.length === 3) {
      // Find the widest stroke (the horizontal bar)
      boundsList.sort((a, b) => b.bounds.width - a.bounds.width);
      const bar = boundsList[0].bounds;
      const d1 = boundsList[1].bounds;
      const d2 = boundsList[2].bounds;

      const isBar = bar.width >= 10 && bar.width > Math.max(bar.height, 1) * 1.3;
      const isD1Small = d1.width <= bar.width * 0.7 && d1.height <= bar.width * 0.7;
      const isD2Small = d2.width <= bar.width * 0.7 && d2.height <= bar.width * 0.7;

      if (isBar && isD1Small && isD2Small) {
        const barMidY = bar.y + bar.height / 2;
        const d1MidY = d1.y + d1.height / 2;
        const d2MidY = d2.y + d2.height / 2;

        const oneAbove = (d1MidY < barMidY && d2MidY > barMidY) || (d2MidY < barMidY && d1MidY > barMidY);
        if (oneAbove) {
          return { token: '÷', confidence: 0.99 };
        }
      }
    }
  }

  // ─── 3. Decimal Point ".": single tiny dot ───
  if (strokes.length === 1) {
    const b = getStrokeBounds(strokes[0]);
    if (b && b.width <= 12 && b.height <= 12 && strokes[0].points.length <= 6) {
      return { token: '.', confidence: 0.96 };
    }
  }

  return null;
}
