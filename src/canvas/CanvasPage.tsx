/**
 * CanvasPage.tsx — Fixed-size page component containing CalcInk's 4 canvas layers.
 *
 * Requirements: FR-1, FR-3, FR-8, FR-9, FR-9b, FR-10, FR-12, FR-13, FR-14, FR-21–25.
 * - Layers: paper -> stroke-canvas -> live-canvas -> answer-canvas.
 * - Pointer events with setPointerCapture, touch-action: none.
 * - rAF-batched drawing and erasing (zero per-point React state).
 * - Full redraw only on undo/redo/erase/clear/resize/DPR change using WeakMap cached Path2D.
 * - Multi-row mathematical recognition running off-thread with answer rendering.
 */

import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import type { StrokeStore } from './strokeStore';
import type { ToolStore, ToolType } from './toolState';
import type { Stroke, RowResult } from '../contract';
import { renderAllStrokes } from './inkRenderer';
import { useCanvasDpr } from './useCanvasDpr';
import { useCanvasInput } from './useCanvasInput';
import { RecognitionPipeline } from '../recognition/pipeline';
import { renderAnswers, clearAnswers } from '../overlay/answerRenderer';
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
  const srOnlyRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<ToolType>(toolStore.tool);

  const latestResultsRef = useRef<readonly RowResult[]>([]);
  const prevAnswersRef = useRef<Map<string, string>>(new Map());
  const animRafRef = useRef<number | null>(null);
  const pipeline = useMemo(() => new RecognitionPipeline(500), []);

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

  const redrawAnswers = useCallback(
    (progress = 1.0, isSuggestion = false, animatingRowIds?: Set<string>) => {
      const answerCanvas = answerCanvasRef.current;
      if (!answerCanvas) return;
      const ctx = answerCanvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = dimensionsRef.current;
      clearAnswers(ctx, width, height);
      if (latestResultsRef.current.length > 0) {
        renderAnswers(ctx, latestResultsRef.current, {
          animationProgress: progress,
          isSuggestion,
          animatingRowIds,
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { dimensionsRef } = useCanvasDpr(
    containerRef,
    [strokeCanvasRef, liveCanvasRef, answerCanvasRef],
    useCallback(() => {
      redrawCommittedCanvas();
      redrawAnswers(1.0, false);
    }, [redrawCommittedCanvas, redrawAnswers])
  );

  // Redraw when store changes (undo, redo, clear, external add/remove) and trigger recognition
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      redrawCommittedCanvas();

      const answerCanvas = answerCanvasRef.current;
      if (!answerCanvas) return;
      const ctx = answerCanvas.getContext('2d');
      if (!ctx) return;
      const { width, height } = dimensionsRef.current;

      if (store.strokes.length === 0) {
        pipeline.cancel();
        if (animRafRef.current !== null) {
          cancelAnimationFrame(animRafRef.current);
          animRafRef.current = null;
        }
        latestResultsRef.current = [];
        prevAnswersRef.current.clear();
        clearAnswers(ctx, width, height);
        if (srOnlyRef.current) srOnlyRef.current.textContent = '';
        return;
      }

      pipeline.recognize(store.strokes, store.version, (results) => {
        // Discard stale results if store has moved on
        if (results.length > 0 && results[0]?.version !== store.version) {
          return;
        }

        latestResultsRef.current = results;

        // Diff to identify which rows actually changed or are newly evaluated
        const changedRowIds = new Set<string>();
        const nextAnswers = new Map<string, string>();

        for (const r of results) {
          if (r.evaluation) {
            const answerKey = `${r.expression}=${r.evaluation.ok ? r.evaluation.value : r.evaluation.error}`;
            nextAnswers.set(r.rowId, answerKey);
            const prevKey = prevAnswersRef.current.get(r.rowId);
            if (prevKey !== answerKey && r.evaluation.ok) {
              changedRowIds.add(r.rowId);
            }
          }
        }
        prevAnswersRef.current = nextAnswers;

        // Cancel any ongoing answer animation
        if (animRafRef.current !== null) {
          cancelAnimationFrame(animRafRef.current);
          animRafRef.current = null;
        }

        // Animate only the changed/new rows: suggestion preview -> smooth ink write-in over 350ms
        if (changedRowIds.size > 0) {
          const startTime = performance.now();
          const duration = 350;

          const animate = (now: number) => {
            const elapsed = now - startTime;
            const rawProgress = Math.min(1.0, elapsed / duration);
            const isSuggestion = rawProgress < 0.25;

            redrawAnswers(rawProgress, isSuggestion, changedRowIds);

            if (rawProgress < 1.0) {
              animRafRef.current = requestAnimationFrame(animate);
            } else {
              animRafRef.current = null;
              // Settle at crisp committed answer
              redrawAnswers(1.0, false);
            }
          };

          animRafRef.current = requestAnimationFrame(animate);
        } else {
          redrawAnswers(1.0, false);
        }

        // Accessible announcement (FR-33)
        if (srOnlyRef.current) {
          const text = results
            .filter((r) => r.evaluation?.ok)
            .map((r) => `${r.expression} = ${r.evaluation.ok ? r.evaluation.value : ''}`)
            .join('; ');
          srOnlyRef.current.textContent = text;
        }
      });
    });

    return () => {
      unsubscribe();
      if (animRafRef.current !== null) {
        cancelAnimationFrame(animRafRef.current);
      }
      pipeline.destroy();
    };
  }, [store, redrawCommittedCanvas, pipeline, redrawAnswers]);

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

      {/* Layer 3: Answer canvas (math results drawn next to '=', non-interactive) */}
      <canvas ref={answerCanvasRef} className="canvas-layer answer-canvas" />

      {/* Accessible screen reader announcement region */}
      <div className="sr-only" ref={srOnlyRef} aria-live="polite" aria-atomic="true" />
    </div>
  );
};
