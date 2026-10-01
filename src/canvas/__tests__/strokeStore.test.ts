import { describe, it, expect, vi } from 'vitest';
import { StrokeStore } from '../strokeStore';
import type { Stroke } from '../../contract';

function createMockStroke(id: string): Stroke {
  return {
    id,
    points: [
      { x: 10, y: 10, pressure: 0.5, t: 100 },
      { x: 20, y: 20, pressure: 0.5, t: 110 },
    ],
    width: 2.5,
    color: '#000000',
    pointerType: 'mouse',
  };
}

describe('StrokeStore', () => {
  it('initializes with empty strokes and version 0', () => {
    const store = new StrokeStore();
    expect(store.strokes).toEqual([]);
    expect(store.version).toBe(0);
    expect(store.canUndo).toBe(false);
    expect(store.canRedo).toBe(false);
  });

  it('adds strokes, updates version, and reports changed stroke IDs', () => {
    const store = new StrokeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    const stroke1 = createMockStroke('s1');
    store.add(stroke1);

    expect(store.strokes).toHaveLength(1);
    expect(store.strokes[0]?.id).toBe('s1');
    expect(store.version).toBe(1);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      action: { type: 'add', stroke: stroke1 },
      changedStrokeIds: ['s1'],
      version: 1,
    });
  });

  it('supports undo and redo, updating version and changed IDs', () => {
    const store = new StrokeStore();
    const s1 = createMockStroke('s1');
    const s2 = createMockStroke('s2');

    store.add(s1);
    store.add(s2);
    expect(store.strokes).toHaveLength(2);
    expect(store.version).toBe(2);

    const listener = vi.fn();
    store.subscribe(listener);

    // Undo s2
    const undone = store.undo();
    expect(undone).toBe(true);
    expect(store.strokes.map((s) => s.id)).toEqual(['s1']);
    expect(store.version).toBe(3);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(true);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        changedStrokeIds: ['s2'],
        version: 3,
      })
    );

    // Redo s2
    const redone = store.redo();
    expect(redone).toBe(true);
    expect(store.strokes.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(store.version).toBe(4);
    expect(store.canUndo).toBe(true);
    expect(store.canRedo).toBe(false);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        changedStrokeIds: ['s2'],
        version: 4,
      })
    );
  });

  it('clears redo stack when a new action is performed after undo', () => {
    const store = new StrokeStore();
    store.add(createMockStroke('s1'));
    store.add(createMockStroke('s2'));

    store.undo(); // now s2 is in redo stack
    expect(store.canRedo).toBe(true);

    // Add a new stroke s3
    store.add(createMockStroke('s3'));
    expect(store.canRedo).toBe(false);
    expect(store.strokes.map((s) => s.id)).toEqual(['s1', 's3']);
  });

  it('clears canvas and makes clear undoable', () => {
    const store = new StrokeStore();
    store.add(createMockStroke('s1'));
    store.add(createMockStroke('s2'));

    const listener = vi.fn();
    store.subscribe(listener);

    store.clear();
    expect(store.strokes).toEqual([]);
    expect(store.canUndo).toBe(true);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        action: { type: 'clear', strokes: expect.any(Array) },
        changedStrokeIds: ['s1', 's2'],
      })
    );

    // Undo clear restores both strokes
    store.undo();
    expect(store.strokes.map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('caps undo history at 100 actions', () => {
    const store = new StrokeStore();

    for (let i = 0; i < 110; i++) {
      store.add(createMockStroke(`stroke-${i}`));
    }

    expect(store.strokes).toHaveLength(110);

    // Undo should only succeed 100 times
    let undoCount = 0;
    while (store.undo()) {
      undoCount++;
    }

    expect(undoCount).toBe(100);
    // 10 strokes remain that cannot be undone
    expect(store.strokes).toHaveLength(10);
  });

  it('unsubscribes listeners correctly', () => {
    const store = new StrokeStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.add(createMockStroke('s1'));
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.add(createMockStroke('s2'));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
