/**
 * useCanvasDpr.ts — Custom hook for managing canvas dimensions and DPR scaling.
 *
 * Requirements: FR-8, FR-9b.
 * Resizes canvases sharply to physical device pixels while keeping CSS pixels fixed.
 */

import { useRef, useEffect, useCallback, type RefObject } from 'react';

export interface CanvasDimensions {
  width: number;
  height: number;
  dpr: number;
}

export function useCanvasDpr(
  containerRef: RefObject<HTMLElement | null>,
  canvases: readonly RefObject<HTMLCanvasElement | null>[],
  onRedraw: (dimensions: CanvasDimensions) => void
) {
  const dimensionsRef = useRef<CanvasDimensions>({
    width: 0,
    height: 0,
    dpr: 1,
  });

  const setupCanvas = (
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    dpr: number
  ) => {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }
  };

  const handleResizeAndDpr = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const dpr = window.devicePixelRatio || 1;

    dimensionsRef.current = { width, height, dpr };

    for (const canvasRef of canvases) {
      if (canvasRef.current) {
        setupCanvas(canvasRef.current, width, height, dpr);
      }
    }

    onRedraw(dimensionsRef.current);
  }, [containerRef, canvases, onRedraw]);

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
      watchDpr();
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
  }, [handleResizeAndDpr, containerRef]);

  return {
    dimensionsRef,
    handleResizeAndDpr,
  };
}
