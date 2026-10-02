// ─── Image Preprocessing ───────────────────────────────────────────
// Center, scale with aspect-ratio preservation, and normalize strokes
// to a 28×28 grayscale tensor (MNIST format: stroke=1, background=0).

import { Stroke, BoundingBox } from '../canvas/strokeModel';

/**
 * Render strokes onto a 28x28 canvas with MNIST-compatible normalization:
 * - Content scaled to fit within a 20x20 area (4px margin)
 * - Centered at (14, 14)
 * - Stroke width normalized to ~2.4px
 * - Inverted grayscale (white background = 0, black ink = 1)
 */
export function preprocessSymbol(
  strokes: Stroke[],
  bounds: BoundingBox,
  targetSize: number = 100,
  channels: number = targetSize === 28 ? 1 : 3,
): Float32Array {
  const totalElements = targetSize * targetSize * channels;
  const tensor = new Float32Array(totalElements);
  if (channels === 3) {
    tensor.fill(1.0); // Default white background for RGB models
  }
  if (strokes.length === 0 || (bounds.width <= 0 && bounds.height <= 0)) {
    return tensor;
  }

  // Check if OffscreenCanvas or document.createElement is available
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetSize, targetSize);
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  } else if (typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = targetSize;
    canvas.height = targetSize;
    ctx = canvas.getContext('2d');
  } else {
    // Headless test environment without canvas support: fallback to direct rasterization
    return rasterizeStrokesDirectly(strokes, bounds, targetSize, channels);
  }

  if (!ctx) {
    return rasterizeStrokesDirectly(strokes, bounds, targetSize, channels);
  }

  // Clear with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetSize, targetSize);

  // Content box: proportional padding
  const padding = channels === 3 ? Math.round(targetSize * 0.2) : 8;
  const contentSize = targetSize - padding;
  const maxDim = Math.max(bounds.width, bounds.height, 1);
  const scale = contentSize / maxDim;

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const halfTarget = targetSize / 2;

  const toTargetX = (x: number) => halfTarget + (x - centerX) * scale;
  const toTargetY = (y: number) => halfTarget + (y - centerY) * scale;

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = channels === 3 ? Math.max(4.0, targetSize * 0.06) : 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;

    if (stroke.points.length === 1) {
      ctx.beginPath();
      ctx.arc(toTargetX(stroke.points[0].x), toTargetY(stroke.points[0].y), 2.0, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    const p0 = stroke.points[0];
    ctx.moveTo(toTargetX(p0.x), toTargetY(p0.y));

    for (let i = 1; i < stroke.points.length - 1; i++) {
      const pCurrent = stroke.points[i];
      const pNext = stroke.points[i + 1];
      const midX = (toTargetX(pCurrent.x) + toTargetX(pNext.x)) / 2;
      const midY = (toTargetY(pCurrent.y) + toTargetY(pNext.y)) / 2;
      ctx.quadraticCurveTo(toTargetX(pCurrent.x), toTargetY(pCurrent.y), midX, midY);
    }

    const last = stroke.points[stroke.points.length - 1];
    ctx.lineTo(toTargetX(last.x), toTargetY(last.y));
    ctx.stroke();
  }

  // Extract pixel data
  const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
  const pixels = imageData.data;

  if (channels === 3) {
    for (let i = 0; i < targetSize * targetSize; i++) {
      tensor[i * 3] = pixels[i * 4] / 255.0;
      tensor[i * 3 + 1] = pixels[i * 4 + 1] / 255.0;
      tensor[i * 3 + 2] = pixels[i * 4 + 2] / 255.0;
    }
    return tensor;
  } else {
    for (let i = 0; i < targetSize * targetSize; i++) {
      const r = pixels[i * 4];
      const g = pixels[i * 4 + 1];
      const b = pixels[i * 4 + 2];
      const gray = (r + g + b) / 3;
      tensor[i] = Math.max(0, Math.min(1, 1.0 - gray / 255.0));
    }
    return centerTensorByMass(tensor, targetSize);
  }
}

/**
 * Main-thread version of preprocessSymbol using HTMLCanvasElement.
 */
export function preprocessSymbolMainThread(
  strokes: Stroke[],
  bounds: BoundingBox,
  targetSize: number = 100,
  channels: number = 3,
): Float32Array {
  return preprocessSymbol(strokes, bounds, targetSize, channels);
}

/**
 * Pure-JS rasterizer fallback for headless testing environments without canvas support.
 */
function rasterizeStrokesDirectly(
  strokes: Stroke[],
  bounds: BoundingBox,
  targetSize: number = 100,
  channels: number = 3,
): Float32Array {
  const tensor = new Float32Array(targetSize * targetSize * channels);
  if (channels === 3) tensor.fill(1.0);
  const padding = channels === 3 ? Math.round(targetSize * 0.2) : 8;
  const contentSize = targetSize - padding;
  const maxDim = Math.max(bounds.width, bounds.height, 1);
  const scale = contentSize / maxDim;

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const halfTarget = targetSize / 2;

  const toTargetX = (x: number) => Math.round(halfTarget + (x - centerX) * scale);
  const toTargetY = (y: number) => Math.round(halfTarget + (y - centerY) * scale);

  for (const stroke of strokes) {
    for (const pt of stroke.points) {
      const tx = toTargetX(pt.x);
      const ty = toTargetY(pt.y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = tx + dx;
          const py = ty + dy;
          if (px >= 0 && px < targetSize && py >= 0 && py < targetSize) {
            if (channels === 3) {
              const idx = (py * targetSize + px) * 3;
              tensor[idx] = 0.0;
              tensor[idx + 1] = 0.0;
              tensor[idx + 2] = 0.0;
            } else {
              tensor[py * targetSize + px] = 1.0;
            }
          }
        }
      }
    }
  }

  if (channels === 3) return tensor;
  return centerTensorByMass(tensor, targetSize);
}

/**
 * Centering by Center of Mass (Centroid of pixel mass) to strictly match MNIST
 * and Irfan Chahyadi pre-trained model input expectations.
 */
function centerTensorByMass(tensor: Float32Array, targetSize: number = 28): Float32Array {
  let totalMass = 0;
  let sumX = 0;
  let sumY = 0;

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const val = tensor[y * targetSize + x];
      if (val > 0.05) {
        totalMass += val;
        sumX += x * val;
        sumY += y * val;
      }
    }
  }

  if (totalMass === 0) {
    return tensor;
  }

  const cx = sumX / totalMass;
  const cy = sumY / totalMass;
  const halfTarget = (targetSize - 1) / 2;
  const shiftX = Math.round(halfTarget - cx);
  const shiftY = Math.round(halfTarget - cy);

  if (shiftX === 0 && shiftY === 0) {
    return tensor;
  }

  const centered = new Float32Array(targetSize * targetSize);
  for (let y = 0; y < targetSize; y++) {
    const srcY = y - shiftY;
    if (srcY < 0 || srcY >= targetSize) continue;
    for (let x = 0; x < targetSize; x++) {
      const srcX = x - shiftX;
      if (srcX < 0 || srcX >= targetSize) continue;
      centered[y * targetSize + x] = tensor[srcY * targetSize + srcX];
    }
  }

  return centered;
}
