/**
 * CanvasPage.tsx — Fixed-size page component containing CalcInk's 4 canvas layers.
 *
 * Requirements: FR-1, FR-3, FR-8, FR-9, FR-9b, FR-10, FR-12, FR-13, FR-14.
 * - Layers: paper -> stroke-canvas -> live-canvas -> answer-canvas.
 * - Pointer events with setPointerCapture, touch-action: none.
 * - rAF-batched drawing and erasing (zero per-point React state).
 * - Eraser drag session aggregates changes; commits exactly ONE action on pointerup.
 * - Full redraw only on undo/redo/erase/clear/resize/DPR change using WeakMap cached Path2D.
 */

import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { StrokeStore } from './strokeStore';
import type { ToolStore, ToolType } from './toolState';
import type { Stroke } from '../contract';
import { renderAllStrokes } from './inkRenderer';
import { useCanvasDpr } from './useCanvasDpr';
import { useCanvasInput } from './useCanvasInput';
import './CanvasPage.css';

export interface CanvasPageProps {
  store: StrokeStore;
  toolStore: ToolStore;
}

export const CanvasPage: React.FC<CanvasPageProps> = ({ store, toolStore }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const answerCanvasRef = useRef<HTMLCanvasElement>(null);

  const [activeTool, setActiveTool] = useState<ToolType>(toolStore.tool);

  useEffect(() => {
    return toolStore.subscribe((state) => {
      setActiveTool(state.tool);
    });
  }, [toolStore]);

  /**
   * Redraws all active strokes onto the stroke-canvas using the WeakMap Path2D cache.
   */
  const redrawCommittedCanvas = useCallback(
    (strokesToRender?: readonly Stroke[]) => {
      const strokeCanvas = strokeCanvasRef.current;
      if (!strokeCanvas) return;
      const ctx = strokeCanvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;
      ctx.clearRect(0, 0, width, height);
      renderAllStrokes(ctx, strokesToRender ?? store.strokes);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store]
  );

  const { dimensionsRef } = useCanvasDpr(
    containerRef,
    [strokeCanvasRef, liveCanvasRef, answerCanvasRef],
    useCallback(() => {
      redrawCommittedCanvas();
    }, [redrawCommittedCanvas])
  );

  // Redraw when store changes (undo, redo, clear, external add/remove)
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      redrawCommittedCanvas();
    });
    return unsubscribe;
  }, [store, redrawCommittedCanvas]);

  const {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = useCanvasInput({
    store,
    toolStore,
    liveCanvasRef,
    strokeCanvasRef,
    dimensionsRef,
    redrawCommittedCanvas,
  });

  return (
    <div className="page-container" ref={containerRef}>
      {/* Layer 1: Stroke canvas (committed strokes) */}
      <canvas ref={strokeCanvasRef} className="canvas-layer stroke-canvas" />

      {/* Layer 2: Live canvas (active stroke, receives pointer events) */}
      <canvas
        ref={liveCanvasRef}
        className={`canvas-layer live-canvas tool-${activeTool}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* Layer 3: Answer canvas (future math results, non-interactive) */}
      <canvas ref={answerCanvasRef} className="canvas-layer answer-canvas" />

      {/* Accessible screen reader announcement region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" />
    </div>
  );
};
