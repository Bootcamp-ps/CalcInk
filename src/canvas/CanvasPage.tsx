/**
 * CanvasPage.tsx — Fixed-size page component containing CalcInk's 4 canvas layers.
 *
 * Requirements: FR-1, FR-3, FR-8, FR-9, FR-9b.
 * - Layers (PRD §7.2): paper (CSS) -> stroke-canvas -> live-canvas -> answer-canvas + sr-only.
 * - Pointer events with setPointerCapture, touch-action: none.
 * - getCoalescedEvents() handling for full point fidelity.
 * - Single requestAnimationFrame per frame for live drawing (zero per-point React state).
 * - Live stroke drawn on live-canvas, committed once onto stroke-canvas on pen-up.
 * - Full redraw only on undo/redo/clear/resize/DPR change using WeakMap cached Path2D.
 * - ResizeObserver + matchMedia DPR listener for high-DPI crispness.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import type { StrokeStore } from './strokeStore';
import type { Point, Stroke } from '../contract';
import { eventToPageCoords } from './coords';
import { renderLiveStroke, renderCommittedStroke, renderAllStrokes } from './inkRenderer';
import './CanvasPage.css';

export interface CanvasPageProps {
  store: StrokeStore;
}

export const CanvasPage: React.FC<CanvasPageProps> = ({ store }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const answerCanvasRef = useRef<HTMLCanvasElement>(null);

  // Drawing state in refs — avoids React re-renders while drawing
  const isDrawingRef = useRef<boolean>(false);
  const activePointerIdRef = useRef<number | null>(null);
  const pointerTypeRef = useRef<'pen' | 'mouse' | 'touch'>('mouse');
  const livePointsRef = useRef<Point[]>([]);
  const rAFIdRef = useRef<number | null>(null);

  // Logical dimension and DPR tracking
  const dimensionsRef = useRef<{ width: number; height: number; dpr: number }>({
    width: 0,
    height: 0,
    dpr: 1,
  });

  /**
   * Resizes a canvas element to match physical device pixels while keeping CSS size fixed.
   */
  const setupCanvasContext = (
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    dpr: number
  ): CanvasRenderingContext2D | null => {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before re-applying scale
      ctx.scale(dpr, dpr);
    }
    return ctx;
  };

  /**
   * Full redraw of committed strokes onto stroke-canvas.
   */
  const redrawCommittedCanvas = useCallback(() => {
    const strokeCanvas = strokeCanvasRef.current;
    if (!strokeCanvas) return;
    const ctx = strokeCanvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensionsRef.current;
    ctx.clearRect(0, 0, width, height);
    renderAllStrokes(ctx, store.strokes);
  }, [store]);

  /**
   * Resize and re-rasterize all canvas layers.
   */
  const handleResizeAndDpr = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    dimensionsRef.current = { width, height, dpr };

    if (strokeCanvasRef.current) setupCanvasContext(strokeCanvasRef.current, width, height, dpr);
    if (liveCanvasRef.current) setupCanvasContext(liveCanvasRef.current, width, height, dpr);
    if (answerCanvasRef.current) setupCanvasContext(answerCanvasRef.current, width, height, dpr);

    redrawCommittedCanvas();
  }, [redrawCommittedCanvas]);

  // Set up resize and DPR change listeners
  useEffect(() => {
    handleResizeAndDpr();

    const resizeObserver = new ResizeObserver(() => {
      handleResizeAndDpr();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    let dprMediaQuery: MediaQueryList | null = null;
    const handleDprChange = () => {
      handleResizeAndDpr();
      watchDpr(); // Re-bind for next DPR change
    };

    const watchDpr = () => {
      if (dprMediaQuery) {
        dprMediaQuery.removeEventListener('change', handleDprChange);
      }
      dprMediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprMediaQuery.addEventListener('change', handleDprChange);
    };

    watchDpr();

    return () => {
      resizeObserver.disconnect();
      if (dprMediaQuery) {
        dprMediaQuery.removeEventListener('change', handleDprChange);
      }
    };
  }, [handleResizeAndDpr]);

  // Subscribe to store updates (undo, redo, clear)
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      redrawCommittedCanvas();
    });
    return unsubscribe;
  }, [store, redrawCommittedCanvas]);

  // Clean up any pending animation frame on unmount
  useEffect(() => {
    return () => {
      if (rAFIdRef.current !== null) {
        cancelAnimationFrame(rAFIdRef.current);
        rAFIdRef.current = null;
      }
    };
  }, []);

  /**
   * Schedules live canvas redraw via requestAnimationFrame.
   */
  const scheduleLiveRender = () => {
    if (rAFIdRef.current !== null) return;

    rAFIdRef.current = requestAnimationFrame(() => {
      rAFIdRef.current = null;
      const liveCanvas = liveCanvasRef.current;
      if (!liveCanvas) return;
      const ctx = liveCanvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = dimensionsRef.current;
      ctx.clearRect(0, 0, width, height);

      // Default ink width: 2.5px, color: css variable or fallback
      renderLiveStroke(
        ctx,
        livePointsRef.current,
        2.5,
        'var(--color-ink, #1a1a2e)',
        pointerTypeRef.current
      );
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Only primary button
    if (e.button !== 0) return;

    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas) return;

    try {
      liveCanvas.setPointerCapture(e.pointerId);
    } catch {
      // Ignore in environments where pointer capture might fail
    }

    isDrawingRef.current = true;
    activePointerIdRef.current = e.pointerId;
    pointerTypeRef.current = (e.pointerType as 'pen' | 'mouse' | 'touch') || 'mouse';

    const rect = liveCanvas.getBoundingClientRect();
    const coords = eventToPageCoords(e.clientX, e.clientY, rect);
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    livePointsRef.current = [
      {
        x: coords.x,
        y: coords.y,
        pressure,
        t: performance.now(),
      },
    ];

    scheduleLiveRender();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== e.pointerId) return;

    const liveCanvas = liveCanvasRef.current;
    if (!liveCanvas) return;

    const rect = liveCanvas.getBoundingClientRect();

    // Use nativeEvent.getCoalescedEvents when supported for high-precision sampling (FR-2)
    const nativeEvt = e.nativeEvent;
    const rawEvents: Array<{ clientX: number; clientY: number; pressure?: number }> =
      typeof (nativeEvt as PointerEvent).getCoalescedEvents === 'function' &&
      (nativeEvt as PointerEvent).getCoalescedEvents().length > 0
        ? (nativeEvt as PointerEvent).getCoalescedEvents()
        : [e];

    for (const evt of rawEvents) {
      const coords = eventToPageCoords(evt.clientX, evt.clientY, rect);
      const pressure = evt.pressure !== undefined && evt.pressure > 0 ? evt.pressure : 0.5;

      livePointsRef.current.push({
        x: coords.x,
        y: coords.y,
        pressure,
        t: performance.now(),
      });
    }

    scheduleLiveRender();
  };

  const finishDrawing = (commit: boolean, pointerId: number) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== pointerId) return;

    const liveCanvas = liveCanvasRef.current;
    if (liveCanvas) {
      try {
        if (liveCanvas.hasPointerCapture(pointerId)) {
          liveCanvas.releasePointerCapture(pointerId);
        }
      } catch {
        // Safe fallback
      }
    }

    if (rAFIdRef.current !== null) {
      cancelAnimationFrame(rAFIdRef.current);
      rAFIdRef.current = null;
    }

    // Clear live canvas
    if (liveCanvas) {
      const ctx = liveCanvas.getContext('2d');
      if (ctx) {
        const { width, height } = dimensionsRef.current;
        ctx.clearRect(0, 0, width, height);
      }
    }

    const points = livePointsRef.current;
    livePointsRef.current = [];
    isDrawingRef.current = false;
    activePointerIdRef.current = null;

    if (commit && points.length > 0) {
      const newStroke: Stroke = {
        id: `stroke-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        points,
        width: 2.5,
        color: 'var(--color-ink, #1a1a2e)',
        pointerType: pointerTypeRef.current,
      };

      // Draw only the new stroke directly onto stroke-canvas (PRD §7.3)
      const strokeCanvas = strokeCanvasRef.current;
      if (strokeCanvas) {
        const strokeCtx = strokeCanvas.getContext('2d');
        if (strokeCtx) {
          renderCommittedStroke(strokeCtx, newStroke);
        }
      }

      // Commit to StrokeStore
      store.add(newStroke);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    finishDrawing(true, e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    finishDrawing(false, e.pointerId);
  };

  return (
    <div className="page-container" ref={containerRef}>
      {/* Layer 1: Stroke canvas (committed strokes) */}
      <canvas ref={strokeCanvasRef} className="canvas-layer stroke-canvas" />

      {/* Layer 2: Live canvas (active stroke, receives pointer events) */}
      <canvas
        ref={liveCanvasRef}
        className="canvas-layer live-canvas"
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
