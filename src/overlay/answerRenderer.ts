/**
 * answerRenderer.ts — Draws answers onto the `answer-canvas` layer (PRD §7.2, D2, FR-21–32).
 *
 * Responsibilities:
 *  - Accept an array of RowResult objects and a CanvasRenderingContext2D
 *    for the dedicated `answer-canvas` (pointer-events: none).
 *  - For each row ending in '=', draw the answer text (Caveat font) immediately to the right
 *    of the anchor '=' bounding box with vertical centring; scale font to ≈ 0.8–0.9 × average
 *    symbol height in that row (FR-21).
 *  - Render "Undefined" for division by zero and a muted "?" for syntax errors.
 *  - Await ensureFontsReady() before the first draw.
 *  - Never touch the stroke-canvas or live-canvas.
 */

import { RowResult } from '../contract';
import { ensureFontsReady } from '../canvas/fontsReady';

export interface AnswerRenderOptions {
  textColor?: string;
  minFontSize?: number;
  maxFontSize?: number;
  gap?: number;
  isSuggestion?: boolean;
  animationProgress?: number;
  animatingRowIds?: Set<string>;
}

/**
 * Draws recognized row answers onto the answer canvas next to each row's '=' sign.
 */
export async function renderAnswers(
  ctx: CanvasRenderingContext2D,
  rows: readonly RowResult[],
  options: AnswerRenderOptions = {}
): Promise<void> {
  const {
    textColor = '#2563eb',
    minFontSize = 18,
    maxFontSize = 140,
    gap = 16,
    isSuggestion = false,
    animationProgress = 1.0,
    animatingRowIds,
  } = options;

  await ensureFontsReady();

  for (const row of rows) {
    if (!row.evaluation || row.symbols.length === 0) continue;

    // Find '=' in row
    const eqIdx = row.symbols.findIndex(s => s?.label === '=');
    if (eqIdx === -1) continue;

    let lastEqualIdx = -1;
    for (let i = row.symbols.length - 1; i >= 0; i--) {
      if (row.symbols[i]?.label === '=') {
        lastEqualIdx = i;
        break;
      }
    }
    if (lastEqualIdx === -1) continue;

    const anyRow = row as any;
    const afterEqSymbols = row.symbols.slice(eqIdx + 1).filter(s => s?.label && s.label !== '=');
    const isTwoSided = afterEqSymbols.length > 0;
    const varSymbol = row.symbols.find(s => /^[a-zA-Z]$/.test(s?.label ?? ''));
    const varName = varSymbol ? varSymbol.label.toLowerCase() : null;
    const isEquationSolve = isTwoSided && varName !== null && row.evaluation.ok;

    // Calculate answer string
    let answerText = '';
    if (row.evaluation.ok) {
      if (isEquationSolve) {
        answerText = `${varName} = ${row.evaluation.value}`;
      } else {
        answerText = String(row.evaluation.value);
      }
    } else if (row.evaluation.error === 'DIV_ZERO') {
      answerText = 'Undefined';
    } else {
      answerText = '?';
    }

    // ─── 1. DYNAMIC SIZE: Match Handwritten Digits ───────────────────
    let referenceHeight = 36;
    if (anyRow.groups && anyRow.groups.length > 0) {
      const digitHeights: number[] = [];
      const allHeights: number[] = [];
      for (let i = 0; i < anyRow.groups.length; i++) {
        const g = anyRow.groups[i];
        const label = row.symbols?.[i]?.label ?? '';
        const h = g.bounds?.height || (g.bounds?.maxY - g.bounds?.minY);
        if (h && Number.isFinite(h) && h > 4) {
          allHeights.push(h);
          if (/^[0-9a-zA-Z]$/.test(label)) {
            digitHeights.push(h);
          }
        }
      }
      if (digitHeights.length > 0) {
        digitHeights.sort((a, b) => b - a);
        referenceHeight = digitHeights[Math.floor(digitHeights.length * 0.25)] || digitHeights[0]!;
      } else if (allHeights.length > 0) {
        allHeights.sort((a, b) => b - a);
        referenceHeight = allHeights[0] || 36;
      }
    } else if (anyRow.bounds?.height && Number.isFinite(anyRow.bounds.height)) {
      referenceHeight = anyRow.bounds.height;
    }

    const fontSize = Math.max(minFontSize, Math.min(maxFontSize, Math.round(referenceHeight * 1.32)));

    // ─── 2. ORIENTATION, ANCHOR & SLANT ──────────────────────────────
    let anchorX = 0;
    let anchorY = 0;
    let theta = 0;

    if (isEquationSolve) {
      // For LHS = RHS equation solving, render "var = value" below the expression
      let rowMinX = Infinity;
      let rowMaxY = -Infinity;

      if (anyRow.groups && anyRow.groups.length > 0) {
        for (const g of anyRow.groups) {
          const minX = g.bounds.minX ?? g.bounds.x;
          const maxY = g.bounds.maxY ?? (g.bounds.y + g.bounds.height);
          if (Number.isFinite(minX) && minX < rowMinX) rowMinX = minX;
          if (Number.isFinite(maxY) && maxY > rowMaxY) rowMaxY = maxY;
        }
      } else if (anyRow.bounds) {
        rowMinX = anyRow.bounds.x;
        rowMaxY = anyRow.bounds.y + anyRow.bounds.height;
      }

      anchorX = Number.isFinite(rowMinX) ? rowMinX : 0;
      anchorY = Number.isFinite(rowMaxY) ? rowMaxY + fontSize * 0.7 : 40;
      theta = 0;
    } else {
      // Standard anchoring to the right of the trailing '='
      const eqGroup = anyRow.groups?.[lastEqualIdx];
      const bounds = eqGroup?.bounds || anyRow.bounds;
      if (bounds) {
        const maxX = bounds.maxX ?? (bounds.x + bounds.width);
        const minY = bounds.minY ?? bounds.y;
        const maxY = bounds.maxY ?? (bounds.y + bounds.height);

        anchorX = (Number.isFinite(maxX) ? maxX : bounds.x + (bounds.width || 0)) + gap;
        anchorY = Number.isFinite(minY) && Number.isFinite(maxY)
          ? (minY + maxY) / 2
          : bounds.y + (bounds.height || 0) / 2;
      }

      // Linear regression angle for standard trailing-equals row
      if (anyRow.groups && anyRow.groups.length >= 2) {
        let sumX = 0, sumY = 0;
        const points: { x: number; y: number }[] = [];
        for (const g of anyRow.groups) {
          const maxX = g.bounds.maxX ?? (g.bounds.x + g.bounds.width);
          const maxY = g.bounds.maxY ?? (g.bounds.y + g.bounds.height);
          const cx = (g.bounds.x + maxX) / 2;
          const cy = (g.bounds.y + maxY) / 2;
          if (Number.isFinite(cx) && Number.isFinite(cy)) {
            points.push({ x: cx, y: cy });
            sumX += cx;
            sumY += cy;
          }
        }
        if (points.length >= 2) {
          const meanX = sumX / points.length;
          const meanY = sumY / points.length;
          let num = 0, den = 0;
          for (const p of points) {
            num += (p.x - meanX) * (p.y - meanY);
            den += (p.x - meanX) ** 2;
          }
          if (den > 25) {
            const slope = num / den;
            theta = Math.max(-0.35, Math.min(0.35, Math.atan(slope)));
          }
        }
      }
    }

    if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) {
      console.warn('[CalcInk:AnswerRenderer] Skipping row: anchor coordinates evaluated to NaN', { row, anchorX, anchorY });
      continue;
    }

    // ─── 3. ADAPTIVE COLOR ───────────────────────────────────────────
    let effectiveColor = textColor;
    if (options.textColor === undefined && typeof document !== 'undefined') {
      const isDark = document.querySelector('.app')?.getAttribute('data-paper-family') === 'dark' ||
                     document.querySelector('[data-paper-family="dark"]') !== null;
      if (isDark) {
        effectiveColor = '#38bdf8'; // Crisp sky blue for chalkboard
      }
    }

    // ─── 4. ANIMATION & SUGGESTION RENDERING ──────────────────────────
    const isRowAnimating = animatingRowIds ? animatingRowIds.has(row.rowId) : false;
    const progress = isRowAnimating ? Math.max(0, Math.min(1, animationProgress)) : 1.0;
    const isRowSuggestion = isRowAnimating ? isSuggestion : false;

    // Ease-out cubic curve
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const slideOffset = (1 - easeProgress) * 8; // Gentle 8px slide-in
    const currentOpacity = isRowSuggestion ? 0.45 : easeProgress;

    ctx.save();
    ctx.translate(anchorX, anchorY);
    // Rotate to match the written equation's trajectory angle
    if (Math.abs(theta) > 0.01) {
      ctx.rotate(theta);
    }
    // Slight ease slide-in along the equation direction
    ctx.translate(slideOffset, 0);

    ctx.font = `600 ${fontSize}px 'Caveat', cursive, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.globalAlpha = currentOpacity;
    ctx.fillStyle = row.evaluation.ok ? effectiveColor : '#ef4444';
    ctx.fillText(answerText, 0, 0);

    // Subtle suggestion dashed badge if in suggestion preview state
    if (isRowSuggestion && row.evaluation.ok) {
      const metrics = ctx.measureText(answerText);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = effectiveColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(-2, -fontSize * 0.42, metrics.width + 4, fontSize * 0.84);
      ctx.restore();
    }

    ctx.restore();
  }
}

/**
 * Clears the answer canvas.
 */
export function clearAnswers(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  ctx.clearRect(0, 0, width, height);
}
