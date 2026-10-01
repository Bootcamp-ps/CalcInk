/**
 * eraserSession.ts — Manages active stroke and pixel eraser drag sessions.
 *
 * Requirements: FR-10, FR-14.
 * - Stroke eraser: tracks all strokes touched during a single drag gesture.
 * - Pixel eraser: tracks progressive cuts and maps fragments back to original strokes.
 * - Commits exactly ONE action per drag gesture on completion.
 * - Zero React imports.
 */

import type { Stroke } from '../contract';
import type { StrokeStore } from './strokeStore';
import { isStrokeHitByEraser, splitStrokeByCircle } from './eraser';

export class EraserSession {
  private readonly _store: StrokeStore;
  private readonly _type: 'stroke-eraser' | 'pixel-eraser';
  private readonly _radius: number;

  // Stroke eraser state
  private _removedStrokes: Stroke[] = [];
  private _remainingStrokes: Stroke[] = [];

  // Pixel eraser state
  private readonly _originalStrokes: readonly Stroke[];
  private _workingStrokes: Stroke[] = [];
  private readonly _touchedOriginalIds = new Set<string>();
  private readonly _fragmentToOriginalMap = new Map<string, string>();

  constructor(
    store: StrokeStore,
    type: 'stroke-eraser' | 'pixel-eraser',
    radius: number
  ) {
    this._store = store;
    this._type = type;
    this._radius = radius;
    this._originalStrokes = [...store.strokes];

    if (type === 'stroke-eraser') {
      this._remainingStrokes = [...store.strokes];
    } else {
      this._workingStrokes = [...store.strokes];
      for (const stroke of store.strokes) {
        this._fragmentToOriginalMap.set(stroke.id, stroke.id);
      }
    }
  }

  public get currentStrokes(): readonly Stroke[] {
    return this._type === 'stroke-eraser'
      ? this._remainingStrokes
      : this._workingStrokes;
  }

  /**
   * Applies eraser points to the session.
   * Returns true if any strokes were modified.
   */
  public processPoints(points: readonly { x: number; y: number }[]): boolean {
    if (points.length === 0) return false;

    let modified = false;

    if (this._type === 'stroke-eraser') {
      for (const pt of points) {
        const nextRemaining: Stroke[] = [];
        for (const stroke of this._remainingStrokes) {
          if (isStrokeHitByEraser(stroke, pt, this._radius)) {
            this._removedStrokes.push(stroke);
            modified = true;
          } else {
            nextRemaining.push(stroke);
          }
        }
        this._remainingStrokes = nextRemaining;
      }
    } else {
      for (const pt of points) {
        let pointModified = false;
        const nextWorking: Stroke[] = [];

        for (const stroke of this._workingStrokes) {
          const split = splitStrokeByCircle(stroke, pt, this._radius);
          if (split.length === 1 && split[0] === stroke) {
            nextWorking.push(stroke);
          } else {
            pointModified = true;
            modified = true;
            const origId = this._fragmentToOriginalMap.get(stroke.id) ?? stroke.id;
            this._touchedOriginalIds.add(origId);

            for (const frag of split) {
              this._fragmentToOriginalMap.set(frag.id, origId);
              nextWorking.push(frag);
            }
          }
        }

        if (pointModified) {
          this._workingStrokes = nextWorking;
        }
      }
    }

    return modified;
  }

  /**
   * Commits the drag gesture as a single undoable action to the StrokeStore.
   */
  public commit(): void {
    if (this._type === 'stroke-eraser') {
      if (this._removedStrokes.length > 0) {
        this._store.remove(this._removedStrokes);
      }
    } else {
      if (this._touchedOriginalIds.size > 0) {
        const before = this._originalStrokes.filter((s) =>
          this._touchedOriginalIds.has(s.id)
        );
        const after = this._workingStrokes.filter((s) => {
          const orig = this._fragmentToOriginalMap.get(s.id);
          return orig !== undefined && this._touchedOriginalIds.has(orig);
        });
        this._store.replace(before, after);
      }
    }
  }
}
