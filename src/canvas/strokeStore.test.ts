import { describe, it, expect, vi } from 'vitest';
import { StrokeStore } from './strokeStore';
import type { Stroke } from '../contract';

function makeStroke(id: string, y = 10): Stroke {
  return {
    id,
    points: [
      { x: 0, y, pressure: 0.5, t: 0 },
      { x: 50, y, pressure: 0.5, t: 10 },
    ],
    width: 2,
    color: '#1a1a2e',
    pointerType: 'mouse',
  };
}

describe('StrokeStore: basic actions, versioning, and changed IDs', () => {
  it('adds strokes, increments version, and reports changed stroke id', () => {
    const store = new StrokeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const s1 = makeStroke('s1');
    store.add(s1);

    expect(store.strokes).toEqual([s1]);
    expect(store.version).toBe(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        action: { type: 'add', stroke: s1 },
        changedStrokeIds: ['s1'],
        version: 1,
      })
    );
  });

  it('removes strokes, increments version, and reports removed IDs', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1');
    const s2 = makeStroke('s2');
    store.add(s1);
    store.add(s2);

    const listener = vi.fn();
    store.subscribe(listener);

    store.remove([s1]);
    expect(store.strokes).toEqual([s2]);
    expect(store.version).toBe(3);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        action: expect.objectContaining({ type: 'remove', strokes: [s1] }),
        changedStrokeIds: ['s1'],
        version: 3,
      })
    );
  });

  it('replaces strokes in-place, increments version, and reports changed IDs', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1');
    const s2 = makeStroke('s2');
    const s3 = makeStroke('s3');
    store.add(s1);
    store.add(s2);
    store.add(s3);

    const frag1 = makeStroke('s2_frag1');
    const frag2 = makeStroke('s2_frag2');

    const listener = vi.fn();
    store.subscribe(listener);

    store.replace([s2], [frag1, frag2]);

    // Position of s2 is replaced in-place by frag1 and frag2
    expect(store.strokes).toEqual([s1, frag1, frag2, s3]);
    expect(store.version).toBe(4);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        action: { type: 'replace', before: [s2], after: [frag1, frag2] },
        changedStrokeIds: expect.arrayContaining(['s2', 's2_frag1', 's2_frag2']),
        version: 4,
      })
    );
  });
});

describe('StrokeStore: undo / redo exact restoration', () => {
  it('undo/redo of remove restores the exact original strokes', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1');
    const s2 = makeStroke('s2');
    store.add(s1);
    store.add(s2);

    store.remove([s1]);
    expect(store.strokes).toEqual([s2]);

    // Undo restore
    const undid = store.undo();
    expect(undid).toBe(true);
    // Must contain exact original s1 object
    expect(store.strokes).toContain(s1);
    expect(store.strokes).toContain(s2);
    expect(store.strokes.length).toBe(2);

    // Redo re-removes
    const redid = store.redo();
    expect(redid).toBe(true);
    expect(store.strokes).toEqual([s2]);
  });

  it('undo/redo of replace restores exact original strokes and order', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1');
    const s2 = makeStroke('s2');
    const s3 = makeStroke('s3');
    store.add(s1);
    store.add(s2);
    store.add(s3);

    const frag1 = makeStroke('s2_a');
    const frag2 = makeStroke('s2_b');

    store.replace([s2], [frag1, frag2]);
    expect(store.strokes).toEqual([s1, frag1, frag2, s3]);

    // Undo replace: exact s2 restored in original spot
    store.undo();
    expect(store.strokes).toEqual([s1, s2, s3]);
    expect(store.strokes[1]).toBe(s2);

    // Redo replace: fragments restored in original spot
    store.redo();
    expect(store.strokes).toEqual([s1, frag1, frag2, s3]);
  });

  it('clears redo stack upon new user action', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1');
    const s2 = makeStroke('s2');
    store.add(s1);
    store.undo();
    expect(store.canRedo).toBe(true);

    store.add(s2);
    expect(store.canRedo).toBe(false);
  });
});

describe('StrokeStore: 100-step cap', () => {
  it('caps history at 100 actions', () => {
    const store = new StrokeStore();
    for (let i = 0; i < 120; i++) {
      store.add(makeStroke(`s_${i}`));
    }

    // Since cap is 100, we should be able to undo at most 100 times
    let undoCount = 0;
    while (store.undo()) {
      undoCount++;
    }

    expect(undoCount).toBe(StrokeStore.MAX_HISTORY);
    expect(undoCount).toBe(100);
    // 20 strokes remain un-undone at the base
    expect(store.strokes.length).toBe(20);
  });
});

import { EraserSession } from './eraserSession';

describe('EraserSession: one action per drag gesture', () => {
  it('stroke eraser commits exactly ONE remove action for a multi-stroke drag', () => {
    const store = new StrokeStore();
    const s1 = makeStroke('s1', 10);
    const s2 = makeStroke('s2', 20);
    const s3 = makeStroke('s3', 50);
    store.add(s1);
    store.add(s2);
    store.add(s3);

    const versionBefore = store.version;
    const session = new EraserSession(store, 'stroke-eraser', 10);

    // Erase point over s1 and s2
    session.processPoints([{ x: 25, y: 10 }]);
    session.processPoints([{ x: 25, y: 20 }]);

    expect(session.currentStrokes).toEqual([s3]);
    // Store version has not changed yet during drag!
    expect(store.version).toBe(versionBefore);

    // Commit drag gesture
    session.commit();
    expect(store.strokes).toEqual([s3]);
    expect(store.version).toBe(versionBefore + 1);

    // Undo restores both s1 and s2 in a single undo step!
    store.undo();
    expect(store.strokes).toEqual([s1, s2, s3]);
  });

  it('pixel eraser commits exactly ONE replace action for multiple cuts in one drag', () => {
    const store = new StrokeStore();
    const s = makeStroke('s_long', 0);
    // Expand points so stroke is from (0, 0) to (100, 0)
    const longStroke: Stroke = {
      ...s,
      points: [
        { x: 0, y: 0, pressure: 0.5, t: 0 },
        { x: 100, y: 0, pressure: 0.5, t: 100 },
      ],
    };
    store.add(longStroke);

    const versionBefore = store.version;
    const session = new EraserSession(store, 'pixel-eraser', 8);

    // Cut 1 at x=30, Cut 2 at x=70 in same drag
    session.processPoints([{ x: 30, y: 0 }]);
    session.processPoints([{ x: 70, y: 0 }]);

    // Store is untouched during drag
    expect(store.version).toBe(versionBefore);

    // Commit drag gesture
    session.commit();
    expect(store.version).toBe(versionBefore + 1);

    // Result should be fragments replacing s_long
    expect(store.strokes.length).toBeGreaterThan(1);
    expect(store.strokes[0]?.id).not.toBe(longStroke.id);

    // Single undo restores the exact original longStroke!
    store.undo();
    expect(store.strokes).toEqual([longStroke]);
    expect(store.strokes[0]).toBe(longStroke);
  });
});

