// @ts-nocheck
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

  // ─── 4. Brackets and Slash: Single stroke ───
  if (strokes.length === 1) {
    const stroke = strokes[0];
    const b = getStrokeBounds(stroke);
    
    // Decimal Point "."
    if (b && b.width <= 15 && b.height <= 15 && stroke.points.length <= 10) {
      return { token: '.', confidence: 0.96 };
    }

    if (b && stroke.points.length >= 3) {
      const p0 = stroke.points[0];
      const pn = stroke.points[stroke.points.length - 1];
      
      const dx = pn.x - p0.x;
      const dy = pn.y - p0.y;
      const chordLen = Math.sqrt(dx * dx + dy * dy);
      
      // Slash "/"
      // High aspect ratio, diagonal top-right to bottom-left (or bottom-left to top-right)
      if (b.height > b.width * 1.2 && chordLen > 15) {
        // Check if points are mostly collinear
        let maxDist = 0;
        let sumDist = 0;
        for (const p of stroke.points) {
          const cross = Math.abs((p.x - p0.x) * dy - (p.y - p0.y) * dx);
          const dist = cross / chordLen;
          if (dist > maxDist) maxDist = dist;
          sumDist += dist;
        }
        const avgDist = sumDist / stroke.points.length;
        
        // Negative slope in math coords, but in canvas (y down), top-right to bottom-left means:
        // x decreases as y increases -> dx < 0 when dy > 0, so dx * dy < 0
        if (dx * dy < 0 && maxDist < b.width * 0.3 && avgDist < b.width * 0.15) {
          return { token: '÷', confidence: 0.95 }; // Map slash to division token
        }
      }

      // Brackets "(" and ")"
      // Must be taller than wide
      if (b.height > b.width * 1.2 && chordLen > 15) {
        let leftBows = 0;
        let rightBows = 0;
        let maxSagitta = 0;

        for (const p of stroke.points) {
          // Cross product to find side of chord
          const cross = (p.x - p0.x) * dy - (p.y - p0.y) * dx;
          const dist = cross / chordLen;
          
          if (Math.abs(dist) > maxSagitta) maxSagitta = Math.abs(dist);

          // In canvas coords (y downwards):
          // If cross * dy < 0, the point bows to the left -> "("
          // If cross * dy > 0, the point bows to the right -> ")"
          if (cross * dy < 0) {
            leftBows++;
          } else if (cross * dy > 0) {
            rightBows++;
          }
        }

        // To reject '3', 'E', 'B', or any shape with a "middle twist or spike":
        // We project every point onto the chord. In the middle 50% of the stroke longitudinally
        // (projection from 0.25 to 0.75), a true bracket should remain bowed outwards.
        // If it dips back towards the chord, it's a twist/cusp.
        let minMiddleDist = Infinity;
        for (const p of stroke.points) {
          const proj = ((p.x - p0.x) * dx + (p.y - p0.y) * dy) / (chordLen * chordLen);
          if (proj >= 0.25 && proj <= 0.75) {
            const cross = (p.x - p0.x) * dy - (p.y - p0.y) * dx;
            const dist = Math.abs(cross / chordLen);
            if (dist < minMiddleDist) minMiddleDist = dist;
          }
        }

        const totalPoints = stroke.points.length;
        
        // Conditions:
        // 1. maxSagitta > chordLen * 0.08 avoids wobbly "1" or "|"
        // 2. minMiddleDist > maxSagitta * 0.4 rejects "3", "E" (middle dips back to the chord)
        // 3. majority of points bow to one side
        if (maxSagitta > chordLen * 0.08 && maxSagitta > 2 && minMiddleDist > maxSagitta * 0.4) {
          if (leftBows > totalPoints * 0.8) {
            return { token: '(', confidence: 0.95 };
          }
          if (rightBows > totalPoints * 0.8) {
            return { token: ')', confidence: 0.95 };
          }
        }
      }
    }
  }

  return null;
}
